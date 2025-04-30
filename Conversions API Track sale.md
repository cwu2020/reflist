Conversions API
Track a sale
Track a sale for a short link.

POST
/
track
/
sale

Try it
Conversions endpoints require a Business plan subscription or higher.

Authorizations
​
Authorization
stringheaderrequired
Default authentication mechanism

Body
application/json
​
externalId
stringrequired
The unique ID of the customer in your system. Will be used to identify and attribute all future events to this customer.

Maximum length: 100
​
amount
integerrequired
The amount of the sale in cents.

Required range: x >= 0
​
paymentProcessor
enum<string>required
The payment processor via which the sale was made.

Available options: stripe, shopify, polar, paddle, custom 
​
eventName
stringdefault:Purchase
The name of the sale event.

Maximum length: 255
Example:
"Invoice paid"

​
invoiceId
string | null
The invoice ID of the sale. Can be used as a idempotency key – only one sale event can be recorded for a given invoice ID.

​
currency
stringdefault:usd
The currency of the sale. Accepts ISO 4217 currency codes.

​
leadEventName
string | null
The name of the lead event that occurred before the sale (case-sensitive). This is used to associate the sale event with a particular lead event (instead of the latest lead event, which is the default behavior).

Example:
"Cloned template 1481267"

​
metadata
object | null
Additional metadata to be stored with the sale event. Max 10,000 characters.


Show child attributes

Response
200

200
application/json
A sale was tracked.
​
eventName
stringrequired
​
customer
object | nullrequired

Show child attributes

​
sale
object | nullrequired


import { Dub } from "dub";

const dub = new Dub({
  token: "DUB_API_KEY",
});

async function run() {
  const result = await dub.track.sale();

  // Handle the result
  console.log(result);
}

run();


200
{
  "eventName": "<string>",
  "customer": {
    "id": "<string>",
    "name": "<string>",
    "email": "<string>",
    "avatar": "<string>",
    "externalId": "<string>"
  },
  "sale": {
    "amount": 123,
    "currency": "<string>",
    "paymentProcessor": "<string>",
    "invoiceId": "<string>",
    "metadata": {}
  }
}

400
{
  "error": {
    "code": "bad_request",
    "message": "The requested resource was not found.",
    "doc_url": "https://dub.co/docs/api-reference/errors#bad-request"
  }
}

401
{
  "error": {
    "code": "unauthorized",
    "message": "The requested resource was not found.",
    "doc_url": "https://dub.co/docs/api-reference/errors#unauthorized"
  }
}