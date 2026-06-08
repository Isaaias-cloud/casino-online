# Casino Online Multiplayer

Casino social multijugador para entretenimiento. Usa creditos virtuales sin valor monetario, Node.js, Express, Socket.IO, Firebase Authentication y Firestore.

> Este sitio es únicamente para entretenimiento y utiliza dinero virtual sin valor monetario.

## Stack

- Frontend: HTML5, CSS3, JavaScript Vanilla, Bootstrap 5.
- Backend: Node.js, Express, Socket.IO.
- Base de datos: Firebase Firestore, plan gratuito.
- Auth: Firebase Authentication, plan gratuito.
- Hosting sugerido: GitHub Pages para frontend, Render para backend y Firebase para datos.

## Ejecutar localmente

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

Sin configurar Firebase, el servidor usa memoria local y permite invitados o perfiles registrados de desarrollo. Para produccion, configura Firebase.

## Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Activa Authentication con proveedor Email/Password.
3. Crea una base Firestore en modo production.
4. Copia la configuracion web en `js/firebase-config.js`.
5. En Project Settings > Service accounts, genera una private key para el backend.
6. En Render, agrega una de estas configuraciones:

```bash
FIREBASE_SERVICE_ACCOUNT_BASE64=<service-account-json-en-base64>
```

O variables sueltas:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Despliegue gratuito

### Backend en Render

1. Sube el proyecto a GitHub.
2. En Render crea un Web Service desde el repo.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Agrega las variables de entorno de `.env.example`.
6. Define `CLIENT_ORIGIN` con la URL de GitHub Pages.

### Frontend en GitHub Pages

1. Publica la rama principal con GitHub Pages.
2. Cambia la conexion Socket.IO en `js/app.js` si el frontend se sirve separado:

```js
const socket = io('https://tu-backend.onrender.com');
```

3. Mantén `js/firebase-config.js` con la configuracion web del proyecto.

### Firestore

El backend crea documentos en `users/{uid}` con:

- `credits`
- `stats`
- `history`
- `registered`
- `name`

La economia se modifica solamente desde servidor.

## Juegos incluidos

- Carreras de Caballos: 2 a 6 jugadores, probabilidades por caballo, ganador decidido por servidor.
- Blackjack: 1 a 4 jugadores, baraja de 52 cartas, dealer se planta en 17, blackjack paga 3:2.
- Billar 2D: 2 jugadores, fisica simplificada, turnos, rebotes, friccion y troneras.
- Tragamonedas: 1 jugador, tres rodillos, diez simbolos, tabla de premios en servidor.

## Seguridad aplicada

- Validacion y limites de datos recibidos por Socket.IO.
- Rate limiting basico por socket y evento.
- Sanitizacion de nombres y mensajes.
- Creditos, barajado, resultados y premios calculados en servidor.
- El cliente nunca decide ganadores ni acredita saldo.

## Estructura

```text
index.html
css/styles.css
js/app.js
js/auth.js
js/firebase-config.js
js/lobby.js
games/horse-race.js
games/blackjack.js
games/pool.js
games/slots.js
server/server.js
server/firebase.js
server/game-manager.js
server/games/*.js
```

## Agregar nuevos juegos

1. Crea una clase que extienda `BaseGame`.
2. Implementa `onCreateRoom`, `onAction` y `publicState`.
3. Registra el juego en `server/server.js` con `manager.registerGame(new TuJuego())`.
4. Crea un renderizador vanilla en `/games/tu-juego.js`.
5. Registra el renderizador con `registerGameRenderer('tu-juego', render)`.
