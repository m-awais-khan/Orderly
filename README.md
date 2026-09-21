<div align="center">

# 🎬 ORDERLY

### *The Intelligent Entertainment Watchlist & AI Recommendation Platform*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-orderly--watchlist.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://orderly-watchlist.vercel.app/)
[![React 19](https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini%20AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Orderly</b> is a modern, full-stack entertainment tracker that transforms how you discover, organize, and track movies and TV shows. Featuring custom smart folders, rich media analytics, shareable curated lists, and tailored recommendations powered by <b>Google Gemini AI</b>.
</p>

[Explore Live Demo](https://orderly-watchlist.vercel.app/) • [Report Bug](https://github.com/m-awais-khan/Orderly/issues) • [Request Feature](https://github.com/m-awais-khan/Orderly/issues)

</div>

---

## ✨ Key Features

- 🤖 **AI-Powered Recommendations**: Tailored movie and TV show suggestions and personalized daily challenges generated using the **Google Gemini API**.
- 🔍 **Live TMDB Integration**: Instant real-time search across millions of movies, TV shows, cast details, seasons, episodes, and poster artwork powered by The Movie Database (TMDB).
- 🗂️ **Dynamic Organization**: Create custom lists, categorize titles with tags and personal descriptions, and structure your collection into nested folders.
- 🔗 **Social Sharing**: Generate unique, public shareable links for any list to share your favorite watches with friends or community.
- 📊 **Deep Analytics & Insights**: Interactive visual charts (genre radar breakdown, completion velocity, watch time trends, rating distributions) powered by **@nivo**.
- 🔒 **Google OAuth 2.0**: Seamless, one-click authentication with Google and encrypted session management.
- 🎨 **Glassmorphic Dark UI**: High-polish responsive design crafted with Tailwind CSS, Framer Motion animations, and custom dark mode themes.
- 📱 **Drag & Drop Reordering**: Fluid desktop and mobile drag-and-drop mechanics to reorder your watchlist priorities effortlessly.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS, PostCSS, Framer Motion
- **Icons**: Lucide React
- **Data Visualization**: `@nivo` (Bar, Line, Pie, Radar charts)
- **Sliders & UI**: Swiper, Mobile Drag Drop
- **HTTP Client**: Axios

### **Backend & APIs**
- **Runtime**: Node.js + Express
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Google OAuth 2.0 (`google-auth-library`), JWT (`jsonwebtoken`)
- **AI Engine**: Google Gemini API (`@google/generative-ai`)
- **Media Database**: TMDB REST API
- **Deployment**: Vercel Serverless Functions

---

## 🚀 Getting Started

Follow these steps to set up and run Orderly locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or local MongoDB)
- A [Google Cloud Console](https://console.cloud.google.com/) OAuth 2.0 Client ID
- A [Google AI Studio](https://aistudio.google.com/) API Key (Gemini)
- A free [TMDB](https://www.themoviedb.org/settings/api) API Key

---

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/m-awais-khan/Orderly.git
   cd Orderly
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to create your local `.env` file:
   ```bash
   cp .env.example .env
   ```

   Fill in your configuration credentials:
   ```env
   # Frontend (Vite)
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   VITE_TMDB_API_KEY=your_tmdb_api_key

   # Backend (Express & MongoDB)
   PORT=3001
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/orderly?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   This will concurrently start both the **Express API server** (on port 3001) and the **Vite frontend server** (on port 5173).

5. **Open in Browser**:
   Navigate to `http://localhost:5173`.

---

## ⚙️ Environment Variables Reference

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `VITE_GOOGLE_CLIENT_ID` | Client | Google OAuth 2.0 Web Client ID for authentication |
| `VITE_TMDB_API_KEY` | Client / Server | TMDB v3 API Key for search and metadata |
| `MONGODB_URI` | Server | MongoDB connection string |
| `JWT_SECRET` | Server | Secret key used to sign and verify user JWT tokens |
| `GEMINI_API_KEY` | Server | Google AI Gemini API Key for recommendations |
| `PORT` | Server | Express backend listening port (default: 3001) |

> ⚠️ **Security Notice**: Never commit `.env` containing production passwords or API keys to any public Git repository.

---

## 📁 Project Architecture

```
Orderly/
├── api/                   # Vercel Serverless Function entry point
│   └── index.js
├── public/                # Static assets, favicons, web app manifest
├── server/                # Express backend application
│   └── server.js          # API endpoints, Mongoose models, Google Auth & proxies
├── src/                   # React frontend application
│   ├── assets/            # Component media assets
│   ├── components/        # UI components (Stats, Modals, AI Overlays, Charts)
│   │   ├── AIRecommendationsOverlay.jsx
│   │   ├── ItemDetailsModal.jsx
│   │   ├── StatsDashboardModal.jsx
│   │   └── ...
│   ├── utils/             # Service utilities (Gemini API, genre helpers)
│   ├── App.jsx            # Main app router & state orchestration
│   ├── AuthPage.jsx       # Google OAuth login interface
│   ├── LandingPage.jsx    # Hero landing page
│   └── WatchListManager.jsx# Core watchlist tracking & list management engine
├── .env.example           # Safe environment variables template
├── .gitignore             # Git ignore definitions
├── package.json           # Project manifest & dependencies
├── tailwind.config.js     # Tailwind CSS theme configuration
├── vercel.json            # Vercel deployment routes configuration
└── vite.config.js         # Vite bundler configuration
```

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Awais Khan**
- **GitHub**: [@m-awais-khan](https://github.com/m-awais-khan)
- **LinkedIn**: [Awais Khan](https://linkedin.com/in/m--awais-khan)
- **Email**: [awais.khan.dot@gmail.com](mailto:awais.khan.dot@gmail.com)
