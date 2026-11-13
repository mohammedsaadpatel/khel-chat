# Khel chat starter (Google login + Nexconn chat)

## 1. Backend
cd server && cp .env.example .env   (fill it in, add serviceAccountKey.json)
npm install && npm start

## 2. Website
cd web && cp .env.example .env   (fill it in)
npm install && npm run dev        (opens http://localhost:5173)

## 3. Test
Open the site in two browsers (or one normal + one private window), sign in with
two different Google accounts, copy each user id into the other's box, and send.
