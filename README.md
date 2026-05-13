# 🎮 SteamVault — Tienda de Juegos Simulada

![SteamVault Banner](https://img.shields.io/badge/SteamVault-Tienda_de_Juegos-6366f1?style=for-the-badge&logo=steam&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)

## 📋 Descripción

**SteamVault** es una aplicación web que simula una tienda de videojuegos al estilo de Steam. Utiliza la API gratuita de **CheapShark** para obtener datos reales de juegos, precios y ofertas, permitiendo al usuario buscar juegos, añadirlos al carrito, realizar compras simuladas y gestionar su biblioteca personal.

> 🤖 **Desarrollado con asistencia de IA** — Este proyecto fue creado utilizando herramientas de Inteligencia Artificial como asistente de programación.

## ✨ Características

| Característica | Descripción |
|---|---|
| 🔍 **Búsqueda de Juegos** | Búsqueda en tiempo real usando la API de CheapShark |
| 🛒 **Carrito de Compra** | Sistema de carrito con cálculo de totales |
| 💳 **Compras Simuladas** | Wallet virtual de 250€ para simular compras |
| 📚 **Biblioteca Personal** | Los juegos comprados se guardan en localStorage |
| 💜 **Wishlist** | Sistema de lista de deseos para guardar juegos |
| 🏷️ **Filtros y Ordenación** | Ordenar por precio, nombre, metacritic y mejor oferta |
| 📱 **Responsive** | Diseño adaptativo para móvil y escritorio |

## 🛠️ Tecnologías

- **HTML5** — Estructura semántica
- **CSS3** — Diseño con glassmorphism, variables CSS y animaciones
- **JavaScript ES6+** — Lógica de la aplicación con async/await
- **CheapShark API** — API gratuita para datos reales de juegos
- **localStorage** — Persistencia de datos del usuario

## 🚀 Cómo Usar

1. Clona el repositorio:
   ```bash
   git clone https://github.com/TU_USUARIO/steam-vault.git
   ```

2. Abre `index.html` en tu navegador, o usa un servidor local:
   ```bash
   # Con Python
   python -m http.server 8091
   
   # O con Node.js
   npx serve -l 8091
   ```

3. ¡Busca juegos, añádelos al carrito y compra!

## 📂 Estructura del Proyecto

```
steam-vault/
├── index.html     # Estructura HTML principal
├── style.css      # Sistema de diseño y estilos
├── app.js         # Lógica de la aplicación
└── README.md      # Documentación
```

## 🔄 Flujo de Git

Este proyecto sigue un flujo de trabajo profesional con Git:

```
master ──── commit 1 ──── commit 2 ──── merge ──── commit final
                                          ↑
feature-update ──── commit 3 ─────────────┘
```

### Historial de Commits

| Commit | Descripción |
|--------|-------------|
| `Initial commit` | Estructura HTML, CSS y JavaScript base |
| `feat: game search` | Integración con CheapShark API |
| `feat: wishlist & sorting` | Sistema de wishlist y filtros (branch: feature-update) |
| `docs: README` | Documentación del proyecto |

## 🌐 Demo en Vivo

👉 [Ver en GitHub Pages](https://TU_USUARIO.github.io/steam-vault/)

## 📜 Licencia

Este proyecto es de código abierto con fines educativos.

---

*Proyecto desarrollado como parte de una práctica de AI-Assisted Development & Git Mastery.*
