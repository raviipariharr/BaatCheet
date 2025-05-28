# 🗨️ BaatCheet

**BaatCheet** is a full-stack real-time chat application built using the MERN stack (MongoDB, Express.js, React.js, Node.js), integrated with Socket.io for real-time communication. It features user authentication, online user status, and a responsive UI powered by Tailwind CSS and Daisy UI.

---

## 🚀 Features

- **Real-time Messaging**: Instant communication using Socket.io.
- **User Authentication & Authorization**: Secure login and signup with JWT.
- **Online User Status**: View active users in real-time.
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS and Daisy UI.
- **Global State Management**: Efficient state handling using Zustand.
- **Error Handling**: Robust error management on both client and server sides.

---

## 🛠️ Technologies Used

- **Frontend**: React.js, Tailwind CSS, Daisy UI, Zustand
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Real-time Communication**: Socket.io
- **Authentication**: JSON Web Tokens (JWT)
- **Media Management**: Cloudinary

---

## 📁 Project Structure

```
BaatCheet/
├── backend/             # Express.js server and API routes
├── frontend/            # React.js client application
├── .gitignore
├── LICENSE
├── README.md
├── package.json
└── package-lock.json
```

---

## ⚙️ Installation

### Prerequisites

- Node.js and npm installed
- MongoDB instance (local or cloud-based)
- Cloudinary account for media storage

### Steps

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/raviipariharr/BaatCheet.git
   cd BaatCheet
   ```

2. **Set Up Environment Variables**:

   Create a `.env` file in the root directory and add the following:

   ```env
   MONGODB_URI=your_mongodb_connection_string
   PORT=5001
   JWT_SECRET=your_jwt_secret

   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret

   NODE_ENV=development
   ```

3. **Install Dependencies**:

   ```bash
   npm install
   ```

4. **Build the Application**:

   ```bash
   npm run build
   ```

5. **Start the Application**:

   ```bash
   npm start
   ```

   The application will be accessible at `http://localhost:5001`.

---

## 🧪 Available Scripts

In the project directory, you can run:

- `npm start`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm test`: Launches the test runner.

---

## 🙌 Acknowledgements

- [React.js](https://reactjs.org/)
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Socket.io](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Daisy UI](https://daisyui.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Cloudinary](https://cloudinary.com/)


