# Project Title: Pan Global Backend

## Description
This project is a backend application built using Node.js and Express. It provides APIs for managing contact form submissions, subscriptions, and user authentication. The application uses MongoDB for data storage and Mongoose for object data modeling.

## Features
- **Authentication API**: Provides user login functionality with JWT token generation for secure access to protected routes.

## Project Structure
```
pan-global-backend
├── app
│   ├── controllers
│   │   ├── contact.controller.js
│   │   └── subscribe.controller.js
│   ├── models
│   │   ├── contact.model.js
│   │   └── subscribe.model.js
│   └── routes
│       ├── contact.route.js
│       └── subscribe.route.js
├── auth
│   ├── controllers
│   │   └── auth.controller.js
│   ├── middleware
│   │   └── auth.middleware.js
│   ├── models
│   │   └── user.model.js
│   └── routes
│       └── auth.route.js
├── config
│   └── db.js
├── .env
├── package.json
├── server.js
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd pan-global-backend
   ```
3. Install the dependencies:
   ```
   npm install
   ```
4. Create a `.env` file in the root directory and add your MongoDB URI and desired port:
   ```
   MONGO_URI=mongodb://localhost:27017/pan-global-backend
   PORT=5000
   ```

## Usage
1. Start the server:
   ```
   npm start
   ```
2. The server will run on the specified port (default: 5000).

## API Endpoints
- **Contact API**
  - `POST /api/contact`: Submit a contact message.
  - `GET /api/messages`: Retrieve all contact messages.

- **Subscription API**
  - `POST /api/subscribe`: Subscribe with an email address.
  - `GET /api/subscribers`: Retrieve all subscribed emails.

- **Authentication API**
  - `POST /api/auth/login`: Log in and receive a JWT token.

## License
This project is licensed under the MIT License.