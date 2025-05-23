import { isBlacklistedEmail } from "@/lib/edge-config";
import { jackson } from "@/lib/jackson";
import { isStored, storage } from "@/lib/storage";
import { UserProps } from "@/lib/types";
import { ratelimit } from "@/lib/upstash";
import { sendEmail } from "@dub/email";
import { subscribe } from "@dub/email/resend/subscribe";
import { LoginLink } from "@dub/email/templates/login-link";
import { WelcomeEmail } from "@dub/email/templates/welcome-email";
import { prisma } from "@dub/prisma";
import { PrismaClient } from "@dub/prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { waitUntil } from "@vercel/functions";
import { User, type NextAuthOptions } from "next-auth";
import { AdapterUser } from "next-auth/adapters";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { createId } from "../api/create-id";
import { createWorkspaceId, prefixWorkspaceId } from "../api/workspace-id";
import { completeProgramApplications } from "../partners/complete-program-applications";
import { FRAMER_API_HOST } from "./constants";
import {
  exceededLoginAttemptsThreshold,
  incrementLoginAttempts,
} from "./lock-account";
import { validatePassword } from "./password";
import { trackLead } from "./track-lead";
import { nanoid, generateRandomString } from "@dub/utils";
import { redis } from "../upstash";
import { Prisma } from "@dub/prisma/client";
import { EventType, LoginEvent } from "@/lib/events/types";

const VERCEL_DEPLOYMENT = !!process.env.VERCEL_URL;

const CustomPrismaAdapter = (p: PrismaClient) => {
  return {
    ...PrismaAdapter(p),
    createUser: async (data: any) => {
      // Create the user first
      const user = await p.user.create({
        data: {
          ...data,
          id: createId({ prefix: "user_" }),
        },
      });

      // Create workspace and partner synchronously with user creation
      try {
        // Create workspace first
        const workspace = await createPersonalWorkspace(user.id, user.name, user.email);
        
        if (!workspace) {
          console.error(`Failed to create workspace for new user ${user.id}`);
          // Don't throw here, we still want the user to be created
        } else {
          // Then create partner
          const { partnerManagementService } = await import('@/lib/services/partner-management-service');
          await partnerManagementService.createPartnerForUser(
            user.id,
            user.name,
            user.email
          );
          
          console.log(`Successfully created workspace and partner for new user ${user.id}`);
        }
      } catch (error) {
        console.error("Error in new user setup:", error);
        // Don't throw here, we still want the user to be created
      }

      return user;
    },
  };
};

// Helper function to create a personal workspace for a user
async function createPersonalWorkspace(userId: string, userName?: string | null, userEmail?: string | null) {
  try {
    // Create workspace name based on user info
    const workspaceName = userName 
      ? `${userName}'s Workspace` 
      : userEmail 
        ? `${userEmail.split('@')[0]}'s Workspace` 
        : 'Personal Workspace';
    
    // Generate a slug from the workspace name
    const baseSlug = workspaceName.toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with a single one
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check if slug exists and add a number if necessary
    while (true) {
      const existingWorkspace = await prisma.project.findUnique({
        where: { slug },
      });
      
      if (!existingWorkspace) break;
      
      // If exists, try with a number suffix
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    console.log(`Creating personal workspace for user ${userId} with slug: ${slug}`);
    
    const workspace = await prisma.$transaction(
      async (tx) => {
        return await tx.project.create({
          data: {
            id: createWorkspaceId(),
            name: workspaceName,
            slug,
            // Set high limits for creators
            linksLimit: 1000000, // Effectively unlimited links
            foldersLimit: 100, // Allow folders for creators
            users: {
              create: {
                userId,
                role: "owner",
                notificationPreference: {
                  create: {},
                },
              },
            },
            billingCycleStart: new Date().getDate(),
            invoicePrefix: generateRandomString(8),
            inviteCode: nanoid(24),
            defaultDomains: {
              create: {}, // by default, we give users all the default domains
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 5000,
      },
    );
    
    console.log(`Successfully created workspace with ID ${workspace.id} and slug ${workspace.slug}`);
    
    // Set this workspace as the user's default
    await prisma.user.update({
      where: { id: userId },
      data: { defaultWorkspace: workspace.slug },
    });
    
    // Set onboarding step to completed since we're skipping the process entirely
    // This is important to avoid navigation issues
    await redis.set(`onboarding-step:${userId}`, "completed");
    
    return workspace;
  } catch (error) {
    console.error("Error creating personal workspace:", error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      sendVerificationRequest({ identifier, url }) {
        if (process.env.NODE_ENV === "development") {
          console.log(`Login link: ${url}`);
          return;
        } else {
          sendEmail({
            email: identifier,
            subject: `Your ${process.env.NEXT_PUBLIC_APP_NAME} Login Link`,
            react: LoginLink({ url, email: identifier }),
          });
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    {
      id: "saml",
      name: "BoxyHQ",
      type: "oauth",
      version: "2.0",
      checks: ["pkce", "state"],
      authorization: {
        url: `${process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://app.thereflist.com')}/api/auth/saml/authorize`,
        params: {
          scope: "",
          response_type: "code",
          provider: "saml",
        },
      },
      token: {
        url: `${process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://app.thereflist.com')}/api/auth/saml/token`,
        params: { grant_type: "authorization_code" },
      },
      userinfo: `${process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://app.thereflist.com')}/api/auth/saml/userinfo`,
      profile: async (profile) => {
        let existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        // user is authorized but doesn't have a Dub account, create one for them
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              id: createId({ prefix: "user_" }),
              email: profile.email,
              name: `${profile.firstName || ""} ${
                profile.lastName || ""
              }`.trim(),
            },
          });
        }

        const { id, name, email, image } = existingUser;

        return {
          id,
          name,
          email,
          image,
        };
      },
      options: {
        clientId: "dummy",
        clientSecret: process.env.NEXTAUTH_SECRET as string,
      },
      allowDangerousEmailAccountLinking: true,
    },
    CredentialsProvider({
      id: "saml-idp",
      name: "IdP Login",
      credentials: {
        code: {},
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        const { code } = credentials;

        if (!code) {
          return null;
        }

        const { oauthController } = await jackson();

        // Fetch access token
        const { access_token } = await oauthController.token({
          code,
          grant_type: "authorization_code",
          redirect_uri: process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://app.thereflist.com'),
          client_id: "dummy",
          client_secret: process.env.NEXTAUTH_SECRET as string,
        });

        if (!access_token) {
          return null;
        }

        // Fetch user info
        const userInfo = await oauthController.userInfo(access_token);

        if (!userInfo) {
          return null;
        }

        let existingUser = await prisma.user.findUnique({
          where: { email: userInfo.email },
        });

        // user is authorized but doesn't have a Dub account, create one for them
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              id: createId({ prefix: "user_" }),
              email: userInfo.email,
              name: `${userInfo.firstName || ""} ${
                userInfo.lastName || ""
              }`.trim(),
            },
          });
        }

        const { id, name, email, image } = existingUser;

        return {
          id,
          email,
          name,
          email_verified: true,
          image,
          // adding profile here so we can access it in signIn callback
          profile: userInfo,
        };
      },
    }),

    // Sign in with email and password
    CredentialsProvider({
      id: "credentials",
      name: "thereflist.com",
      type: "credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          throw new Error("no-credentials");
        }

        const { email, password } = credentials;

        if (!email || !password) {
          throw new Error("no-credentials");
        }

        const { success } = await ratelimit(5, "1 m").limit(
          `login-attempts:${email}`,
        );

        if (!success) {
          throw new Error("too-many-login-attempts");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            passwordHash: true,
            name: true,
            email: true,
            image: true,
            invalidLoginAttempts: true,
            emailVerified: true,
          },
        });

        if (!user || !user.passwordHash) {
          throw new Error("invalid-credentials");
        }

        if (exceededLoginAttemptsThreshold(user)) {
          throw new Error("exceeded-login-attempts");
        }

        const passwordMatch = await validatePassword({
          password,
          passwordHash: user.passwordHash,
        });

        if (!passwordMatch) {
          const exceededLoginAttempts = exceededLoginAttemptsThreshold(
            await incrementLoginAttempts(user),
          );

          if (exceededLoginAttempts) {
            throw new Error("exceeded-login-attempts");
          } else {
            throw new Error("invalid-credentials");
          }
        }

        if (!user.emailVerified) {
          throw new Error("email-not-verified");
        }

        // Reset invalid login attempts
        await prisma.user.update({
          where: { id: user.id },
          data: {
            invalidLoginAttempts: 0,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),

    // Framer
    {
      id: "framer",
      name: "Framer",
      type: "oauth",
      clientId: process.env.FRAMER_CLIENT_ID,
      clientSecret: process.env.FRAMER_CLIENT_SECRET,
      checks: ["state"],
      authorization: `${FRAMER_API_HOST}/auth/oauth/authorize`,
      token: `${FRAMER_API_HOST}/auth/oauth/token`,
      userinfo: `${FRAMER_API_HOST}/auth/oauth/profile`,
      profile({ sub, email, name, picture }) {
        return {
          id: sub,
          name,
          email,
          image: picture,
        };
      },
    },
  ],
  // @ts-ignore
  adapter: CustomPrismaAdapter(prisma),
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: `${VERCEL_DEPLOYMENT ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // When working on localhost, the cookie domain must be omitted entirely (https://stackoverflow.com/a/1188145)
        domain: VERCEL_DEPLOYMENT
          ? `.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
          : undefined,
        secure: VERCEL_DEPLOYMENT,
      },
    },
  },
  pages: {
    signIn: process.env.NODE_ENV === 'development' ? '/app.thereflist.com/login' : '/login',
    error: process.env.NODE_ENV === 'development' ? '/app.thereflist.com/login' : '/login',
  },
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      console.log({ user, account, profile });

      if (!user.email || (await isBlacklistedEmail(user.email))) {
        return false;
      }

      if (user?.lockedAt) {
        return false;
      }

      if (account?.provider === "google" || account?.provider === "github") {
        const userExists = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, name: true, image: true },
        });
        if (!userExists || !profile) {
          return true;
        }
        // if the user already exists via email,
        // update the user with their name and image
        if (userExists && profile) {
          const profilePic =
            profile[account.provider === "google" ? "picture" : "avatar_url"];
          let newAvatar: string | null = null;
          // if the existing user doesn't have an image or the image is not stored in R2
          if (
            (!userExists.image || !isStored(userExists.image)) &&
            profilePic
          ) {
            const { url } = await storage.upload(
              `avatars/${userExists.id}`,
              profilePic,
            );
            newAvatar = url;
          }
          await prisma.user.update({
            where: { email: user.email },
            data: {
              // @ts-expect-error - this is a bug in the types, `login` is a valid on the `Profile` type
              ...(!userExists.name && { name: profile.name || profile.login }),
              ...(newAvatar && { image: newAvatar }),
            },
          });
        }
      } else if (
        account?.provider === "saml" ||
        account?.provider === "saml-idp"
      ) {
        let samlProfile;

        if (account?.provider === "saml-idp") {
          // @ts-ignore
          samlProfile = user.profile;
          if (!samlProfile) {
            return true;
          }
        } else {
          samlProfile = profile;
        }

        if (!samlProfile?.requested?.tenant) {
          return false;
        }
        const workspace = await prisma.project.findUnique({
          where: {
            id: samlProfile.requested.tenant,
          },
        });
        if (workspace) {
          await Promise.allSettled([
            // add user to workspace
            prisma.projectUsers.upsert({
              where: {
                userId_projectId: {
                  projectId: workspace.id,
                  userId: user.id,
                },
              },
              update: {},
              create: {
                projectId: workspace.id,
                userId: user.id,
              },
            }),
            // delete any pending invites for this user
            prisma.projectInvite.delete({
              where: {
                email_projectId: {
                  email: user.email,
                  projectId: workspace.id,
                },
              },
            }),
          ]);
        }
        // Login with Framer
      } else if (account?.provider === "framer") {
        const userFound = await prisma.user.findUnique({
          where: {
            email: user.email,
          },
          include: {
            accounts: true,
          },
        });

        // account doesn't exist, let the user sign in
        if (!userFound) {
          return true;
        }

        const otherAccounts = userFound?.accounts.filter(
          (account) => account.provider !== "framer",
        );

        // we don't allow account linking for Framer partners
        // so redirect to the standard login page
        if (otherAccounts && otherAccounts.length > 0) {
          throw new Error("framer-account-linking-not-allowed");
        }

        return true;
      }

      // After sign-in, we register event handlers and emit LOGIN event with other callbacks
      try {
        // Import here to avoid circular dependency
        const { registerEventHandlers } = await import('@/lib/events/register-handlers');
        const { emitEvent } = await import('@/lib/events/emitter');
        const { EventType } = await import('@/lib/events/types');
        
        // Make sure handlers are registered
        registerEventHandlers();
        
        // Log the full account object for debugging
        console.log("Auth callback account object:", {
          provider: account?.provider,
          callbackUrl: account?.callbackUrl,
          state: account?.state,
          redirect: (account as any)?.redirect,
          referer: (account as any)?.referer,
        });
        
        // Look for pending phone verification in partner ID from state
        let phoneNumberPendingClaim: string | undefined;
        let partnerId: string | undefined;
        
        try {
          // Try to extract partner info from state parameter first (most reliable)
          if (account?.state && typeof account.state === 'string') {
            try {
              // Parse state as JSON
              const stateData = JSON.parse(account.state);
              if (stateData && stateData.pid && stateData.pid !== 'unknown') {
                partnerId = stateData.pid;
                console.log(`Found partner ID in state: ${partnerId}`);
                
                // If we have both partner ID and phone number, we're good
                if (stateData.phn) {
                  phoneNumberPendingClaim = stateData.phn;
                  console.log(`Found phone number in state: ${phoneNumberPendingClaim}`);
                } else {
                  // Look up the partner to get the phone number
                  // Use a raw query since phoneNumber might not be in the type
                  const partners = await prisma.$queryRaw`
                    SELECT phoneNumber FROM Partner WHERE id = ${partnerId} LIMIT 1
                  `;
                  
                  if (Array.isArray(partners) && partners.length > 0 && partners[0].phoneNumber) {
                    phoneNumberPendingClaim = partners[0].phoneNumber;
                    console.log(`Retrieved phone number ${phoneNumberPendingClaim} from partner ${partnerId}`);
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing state JSON:', e);
            }
          }
          
          // If we couldn't get the info from state, try legacy methods as fallback
          if (!phoneNumberPendingClaim) {
            // Legacy extraction code
            let pendingPhone: string | undefined;
            
            // First try the state parameter (Google sign-in doesn't support custom state params)
            if (account?.state && typeof account.state === 'string') {
              try {
                // Try parsing as JSON first
                const stateData = JSON.parse(account.state);
                if (stateData && stateData.pendingPhoneVerification) {
                  pendingPhone = stateData.pendingPhoneVerification;
                  console.log(`Found pending phone verification in state as JSON: ${pendingPhone}`);
                }
              } catch (e) {
                // If it's not valid JSON, check if it contains the parameter directly
                console.log('State parameter is not valid JSON');
                
                // It could be a URL-encoded string, try to extract directly
                if (account.state.includes('pendingPhoneVerification=')) {
                  try {
                    // Try to extract from URL-encoded string
                    const match = account.state.match(/pendingPhoneVerification=([^&]+)/);
                    if (match && match[1]) {
                      pendingPhone = decodeURIComponent(match[1]);
                      console.log(`Found pending phone verification in state as URL param: ${pendingPhone}`);
                    }
                  } catch (e2) {
                    console.log('Could not extract phone from state as URL param', e2);
                  }
                }
              }
            }
            
            // If not found in state, check in callbackUrl, redirect or referer
            if (!pendingPhone) {
              const urlString = account?.callbackUrl || (account as any)?.redirect || (account as any)?.referer || '';
              console.log('Checking for phone in URL:', urlString);
              
              if (urlString && typeof urlString === 'string') {
                // Try to parse URL without throwing
                try {
                  const url = new URL(urlString);
                  const pendingPhoneParam = url.searchParams.get('pendingPhoneVerification');
                  
                  if (pendingPhoneParam) {
                    pendingPhone = pendingPhoneParam;
                    console.log(`Found pending phone verification in URL params: ${pendingPhone}`);
                  }
                } catch (e) {
                  console.log('Could not parse URL:', urlString);
                  
                  // Try direct regex extraction as fallback
                  try {
                    const match = urlString.match(/pendingPhoneVerification=([^&]+)/);
                    if (match && match[1]) {
                      pendingPhone = decodeURIComponent(match[1]);
                      console.log(`Found pending phone verification via regex in URL: ${pendingPhone}`);
                    }
                  } catch (e2) {
                    console.log('Regex extraction failed:', e2);
                  }
                }
              }
            }
            
            // If found in alternate ways, assign to phoneNumberPendingClaim
            if (pendingPhone) {
              phoneNumberPendingClaim = pendingPhone;
            }
          }
        } catch (e) {
          console.error('Error extracting partner/phone verification data:', e);
        }
        
        // Create the event payload based on whether we have a pending phone verification
        if (phoneNumberPendingClaim) {
          console.log(`Emitting LOGIN event with pending phone ${phoneNumberPendingClaim} for user ${user.id}`);
          if (partnerId) {
            console.log(`Including partner ID ${partnerId} in LOGIN event`);
            emitEvent(EventType.LOGIN, {
              userId: user.id,
              phoneNumberPendingClaim,
              partnerId
            } as Omit<LoginEvent, 'type' | 'timestamp'>);
          } else {
            emitEvent(EventType.LOGIN, {
              userId: user.id,
              phoneNumberPendingClaim
            } as Omit<LoginEvent, 'type' | 'timestamp'>);
          }
        } else {
          console.log(`Emitting LOGIN event without pending phone for user ${user.id}`);
          emitEvent(EventType.LOGIN, {
            userId: user.id
          } as Omit<LoginEvent, 'type' | 'timestamp'>);
        }
        
        // Log what happened for debugging
        if (phoneNumberPendingClaim) {
          console.log(`Login event emitted for user ${user.id} with phone verification ${phoneNumberPendingClaim}`);
        } else {
          console.log(`Login event for user ${user.id} has no pending phone verification to claim`);
        }
      } catch (error) {
        console.error("Error emitting LOGIN event:", error);
      }

      return true;
    },
    jwt: async ({
      token,
      user,
      trigger,
    }: {
      token: JWT;
      user: User | AdapterUser | UserProps;
      trigger?: "signIn" | "update" | "signUp";
    }) => {
      if (user) {
        token.user = user;
      }

      // refresh the user's data if they update their name / email
      if (trigger === "update") {
        const refreshedUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });
        if (refreshedUser) {
          token.user = refreshedUser;
        } else {
          return {};
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      session.user = {
        id: token.sub,
        // @ts-ignore
        ...(token || session).user,
      };
      return session;
    },
  },
  events: {
    async signIn(message) {
      if (message.isNewUser) {
        const email = message.user.email as string;
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        });
        if (!user) {
          return;
        }
        
        // only send the welcome email if the user was created in the last 10s
        if (
          user.createdAt &&
          new Date(user.createdAt).getTime() > Date.now() - 10000 &&
          process.env.NEXT_PUBLIC_IS_DUB
        ) {
          waitUntil(
            Promise.allSettled([
              subscribe({ email, name: user.name || undefined }),
              sendEmail({
                email,
                replyTo: "steven.tey@dub.co",
                subject: "Welcome to RefList!",
                react: WelcomeEmail({
                  email,
                  name: user.name || null,
                }),
                scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                variant: "marketing",
              }),
              trackLead(user),
            ]),
          );
        }
      }
      // lazily backup user avatar to R2
      const currentImage = message.user.image;
      if (currentImage && !isStored(currentImage)) {
        waitUntil(
          (async () => {
            const { url } = await storage.upload(
              `avatars/${message.user.id}`,
              currentImage,
            );
            await prisma.user.update({
              where: {
                id: message.user.id,
              },
              data: {
                image: url,
              },
            });
          })(),
        );
      }

      // Complete any outstanding program applications
      waitUntil(completeProgramApplications(message.user.id));
    },
  },
};

