# 🎓 Language School - Vintage Edition

Una web espectacular con diseño vintage para tu academia de inglés en Jódar, Jaén.

## ✨ Características Destacadas

### 🎨 Diseño Visual
- **Estilo Vintage Elegante**: Paleta de colores cálidos (crema, dorado, cobre, marrón)
- **Tipografías Clásicas**: Georgia, Palatino, fuentes serif de alta calidad
- **Texturas de Papel Antiguo**: Efecto grain/noise para autenticidad vintage
- **Elementos Decorativos**: Ornamentos art deco, bordes dobles, iconos vintage

### 💫 Animaciones y Efectos
- **Parallax Scrolling**: Efecto de profundidad en elementos al hacer scroll
- **Scroll Reveal**: Los elementos aparecen suavemente al entrar en pantalla
- **Hover Effects**: Efectos espectaculares al pasar el mouse sobre botones y tarjetas
- **Cursor Personalizado**: Cursor vintage con trail animado
- **Smooth Scroll**: Desplazamiento suave entre secciones
- **Loading Animation**: Pantalla de carga elegante
- **Floating Cards**: Tarjetas que flotan suavemente
- **Progress Bar**: Barra de progreso de scroll

### 🎪 Características Especiales
- **Mouse Parallax**: Las tarjetas siguen el movimiento del mouse
- **Typing Effect**: Efecto de máquina de escribir en títulos destacados
- **Number Animation**: Los números se animan al aparecer
- **Gradient Shimmer**: Efecto brillante en textos importantes
- **Smooth Transitions**: Transiciones cinematográficas entre estados

## 📁 Estructura de Archivos

```
vintage-academy/
├── index.html          # Página principal
├── academia.html       # Metodología y cursos
├── precios.html        # Planes y tarifas
├── contacto.html       # Formulario y ubicación
├── assets/
│   ├── style.css       # Estilos CSS vintage con animaciones
│   └── app.js          # JavaScript con efectos parallax y animaciones
└── README.md           # Este archivo
```

## 🚀 Cómo Subir a GitHub

### Opción 1: Usando GitHub Desktop (Más Fácil)

1. **Instala GitHub Desktop**
   - Descarga desde: https://desktop.github.com/
   - Instala y abre sesión con tu cuenta de GitHub

2. **Crea un Nuevo Repositorio**
   - Click en "File" → "New repository"
   - Nombre: `language-school-vintage`
   - Descripción: `Academia de inglés con diseño vintage espectacular`
   - Marca "Initialize this repository with a README"
   - Click "Create repository"

3. **Añade los Archivos**
   - Copia todos los archivos de esta carpeta al repositorio local
   - Los cambios aparecerán automáticamente en GitHub Desktop
   - Escribe un mensaje: "✨ Diseño vintage inicial"
   - Click "Commit to main"
   - Click "Publish repository" (o "Push origin")

4. **Activa GitHub Pages**
   - Ve a tu repositorio en github.com
   - Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: "main" → folder: "/ (root)"
   - Guarda
   - Tu web estará en: `https://TU-USUARIO.github.io/language-school-vintage/`

### Opción 2: Usando Línea de Comandos

```bash
# 1. Inicializa el repositorio
git init

# 2. Añade todos los archivos
git add .

# 3. Haz el primer commit
git commit -m "✨ Diseño vintage inicial con animaciones espectaculares"

# 4. Crea el repositorio en GitHub (hazlo desde la web primero)
# Luego conecta el repositorio local:
git remote add origin https://github.com/TU-USUARIO/language-school-vintage.git

# 5. Sube los archivos
git branch -M main
git push -u origin main

# 6. Activa GitHub Pages desde Settings → Pages
```

## 🎨 Personalización

### Cambiar Colores
Edita las variables CSS en `assets/style.css`:
```css
:root {
  --vintage-cream: #F5E6D3;    /* Color de fondo principal */
  --vintage-gold: #D4AF37;     /* Color dorado de acentos */
  --vintage-copper: #B87333;   /* Color cobre */
  /* ... más colores */
}
```

### Añadir tu Logo
Reemplaza el SVG en el `<header>` de cada archivo HTML con tu logo personalizado.

### Modificar Información de Contacto
En `contacto.html`:
- Cambia los números de teléfono
- Añade tu email real
- Pega tu iframe de Google Maps en la sección del mapa

### Ajustar Precios
En `precios.html`:
- Modifica los precios en las tarjetas `.price`
- Añade o quita planes según tus necesidades

## 🌐 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Animaciones, gradientes, efectos visuales
- **JavaScript Vanilla**: Sin frameworks, código puro y rápido
- **SVG**: Gráficos vectoriales escalables
- **Intersection Observer API**: Animaciones al scroll eficientes
- **RequestAnimationFrame**: Animaciones fluidas a 60fps

## 📱 Responsive Design

La web es completamente responsive y se adapta perfectamente a:
- 📱 Móviles (320px - 768px)
- 📱 Tablets (768px - 1024px)
- 💻 Desktop (1024px+)
- 🖥️ Pantallas grandes (1440px+)

## ⚡ Optimizaciones

- **Lazy Loading**: Imágenes se cargan solo cuando son necesarias
- **Smooth Animations**: 60 FPS con requestAnimationFrame
- **Reduced Motion**: Respeta preferencias de accesibilidad
- **Lightweight**: Sin dependencias externas pesadas
- **Fast Loading**: CSS y JS optimizados

## 🎯 SEO y Accesibilidad

- Meta tags optimizados
- Estructura HTML semántica
- Alt text en imágenes
- Aria labels
- Contraste de colores accesible
- Navegación por teclado

## 🎨 Easter Eggs

La web incluye algunos "huevos de pascua" divertidos:
- **Konami Code**: Prueba a escribir: ↑ ↑ ↓ ↓ ← → ← → B A
- **Cursor Trail**: El cursor deja un rastro dorado
- **Hover Effects**: Explora todos los elementos interactivos

## 📝 Notas Importantes

1. **Email del Formulario**: El formulario usa `mailto:`. Para producción, considera usar:
   - Formspree: https://formspree.io/
   - Netlify Forms: https://www.netlify.com/products/forms/
   - EmailJS: https://www.emailjs.com/

2. **Google Maps**: Añade tu iframe real de Google Maps en la sección de ubicación.

3. **Actualización de Contenido**: Todos los textos son editables directamente en los archivos HTML.

## 🤝 Soporte

Si necesitas ayuda o tienes preguntas:
1. Revisa este README
2. Consulta los comentarios en el código
3. Busca en GitHub Discussions del proyecto

## 📄 Licencia

Este proyecto es de uso libre. Personalízalo como quieras para tu academia.

---

**🎨 Diseñado con amor y estilo vintage**

*¿Te gusta esta web? ¡Dale una estrella ⭐ en GitHub!*
