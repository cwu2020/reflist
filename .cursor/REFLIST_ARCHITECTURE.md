# Reflist Architecture Documentation

## Overview

Reflist is a monorepo built on top of the Dub.co codebase. It's a modern web application designed with a modular architecture using Next.js and organized as a monorepo with multiple packages. This document provides a comprehensive overview of the repository structure, architecture, and guidelines for extending and customizing the application.

## Repository Structure

The repository is organized as a monorepo using pnpm workspaces with the following main directories:

- `apps/`: Contains the main applications.
  - `web/`: The main Next.js web application.
- `packages/`: Contains shared libraries and modules used across the applications.
  - `ui/`: Reusable UI components.
  - `utils/`: Utility functions and constants.
  - `prisma/`: Database schema and Prisma client.
  - `email/`: Email templates and sending functionality.
  - `tailwind-config/`: Shared Tailwind configuration.
  - `embeds/`: Components for embedding Reflist on other websites.

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MySQL (via Prisma ORM)
- **Package Manager**: pnpm
- **Monorepo Management**: Turborepo
- **UI Components**: Custom components in the `packages/ui` directory
- **Authentication**: NextAuth.js
- **Deployment**: Vercel

## Core Concepts

### Monorepo Architecture

The project uses pnpm workspaces (defined in `pnpm-workspace.yaml`) to manage multiple packages within a single repository. This allows for:

- Sharing code between different applications
- Maintaining a consistent development environment
- Simplifying dependency management

Turborepo (`turbo.json`) is used to optimize build processes and manage task dependencies across packages.

### Next.js App Router

The web application uses Next.js App Router for routing and page rendering. The main structure is located in `apps/web/app/` where:

- Each directory represents a route
- `layout.tsx` files define the layout for a route and its children
- `page.tsx` files define the content of a route
- Dynamic routes are denoted with `[paramName]` syntax

### Database Schema

The database schema is defined using Prisma in the `packages/prisma/schema/` directory with models split across multiple files:

- `schema.prisma`: Main schema file that imports other schema files
- Specific model files like `link.prisma`, `domain.prisma`, etc.

The main entities include:
- `User`: User accounts and authentication
- `Project`: Workspace/organization information
- `Domain`: Domain configurations
- `Link`: Short links
- Additional models for features like tags, folders, webhooks, etc.

### UI Component Library

The UI component library (`packages/ui`) contains reusable components that follow consistent design patterns:

- Basic components like `Button`, `Input`, `Modal`, etc.
- Complex components like charts, tables, and specialized UI elements
- Each component is exported from `packages/ui/src/index.tsx`

### Utility Functions

Shared utility functions (`packages/utils`) include:

- Constants for configuration
- Helper functions for common operations
- Type definitions
- Formatting and validation utilities

## Routing Structure

The application has several routing domains handled by the `middleware.ts` file:

1. **App domain**: User-facing application
2. **API domain**: API endpoints 
3. **Admin domain**: Administration interface
4. **Partners domain**: Partner/affiliate portal
5. **Link domain**: For short link redirects

## Authentication and Authorization

Authentication is implemented using NextAuth.js with multiple strategies:

- Email/password
- OAuth providers
- Token-based authentication for API access

User roles and permissions are managed through the `Role` enum and workspace-based access control.

## Common Patterns

### Data Fetching

Data fetching primarily uses SWR for client-side data fetching and Next.js Server Components for server-side rendering.

### Form Handling

Forms typically use React Hook Form with Zod for validation.

### Styling

Styling is managed through Tailwind CSS with custom configurations and utility classes:

- Custom classes are defined in the tailwind config
- The `cn` utility is used for conditional class names
- Component-specific styles are co-located with components

## Extension Guidelines

### Adding a New Route

To add a new route:

1. Create a new directory in `apps/web/app/`
2. Add a `page.tsx` file for the route content
3. Optionally add a `layout.tsx` file for route-specific layout

### Creating a New Component

To create a new UI component:

1. Add the component file in `packages/ui/src/`
2. Export it from `packages/ui/src/index.tsx`
3. Use consistent patterns (props interface, styling with `cn`, etc.)

### Extending the Database Schema

To extend the database schema:

1. Add your model to an appropriate file in `packages/prisma/schema/`
2. Run `pnpm prisma:generate` to update the Prisma client
3. Run `pnpm prisma:push` to apply the changes to the database

### Adding a New API Endpoint

To add a new API endpoint:

1. Create a route handler in `apps/web/app/api/`
2. Define the request/response data structures
3. Implement authentication/authorization checks
4. Handle the request and return an appropriate response

## Deployment and CI/CD

The application is configured for deployment on Vercel with:

- Automatic deployments from the main branch
- Preview deployments for pull requests
- Environment variables managed through Vercel

## Customization Guidelines

### Branding and Theme

To customize branding and theme:

1. Modify colors in `packages/tailwind-config/tailwind.config.js`
2. Update logos and assets in `packages/ui/src/logo.tsx` and similar files
3. Adjust global styles in `apps/web/styles/globals.css`

### Configuration

Key configuration files to modify:

1. `next.config.js`: Next.js configuration 
2. `turbo.json`: Turborepo pipeline configuration
3. `.env`: Environment variables (never commit sensitive values)

## Troubleshooting and Development

### Local Development

1. Install dependencies: `pnpm install`
2. Start the development server: `pnpm dev`
3. Run specific package commands: `pnpm --filter=@dub/ui dev`

### Common Issues

- **Build errors**: Check for missing dependencies or TypeScript errors
- **Database issues**: Verify Prisma schema and connection string
- **API errors**: Check request/response formats and authentication

## Conclusion

This architecture provides a flexible foundation for building and extending the Reflist application. By understanding the core concepts and following the established patterns, you can efficiently develop new features while maintaining consistency with the existing codebase. 