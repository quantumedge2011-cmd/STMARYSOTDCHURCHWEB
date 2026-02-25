/**
 * Image Management Strategy v2
 * Placeholders are marked with 'img1', 'img2', etc.
 * To replace an image, simply add a file named 'img1.webp' (or .jpg/.png) 
 * to the assets folder and update the link here.
 */

const CHURCH_IMAGES = {
    logo: "./assets/logo.png", // Main Logo
    img1: "./assets/img1.webp", // Hero
    img2: "./assets/img2.webp", // Vicar
    img3: "./assets/img3.webp", // Trustee
    img4: "./assets/img4.webp", // Secretary
    img5: "./assets/img5.webp", // History
    qr_gen: "./assets/qr_general.png",
    qr_nercha: "./assets/qr_nercha.png",
    qr_feast: "./assets/qr_feast.png",
    qr_project: "./assets/qr_project.png",
    img6: "./assets/img6.webp", // Catering
    img7: "./assets/img7.webp", // Lights
    img8: "./assets/img8.webp", // Camera
    img9: "./assets/img9.webp", // Portal
    img10: "./assets/img10.webp", // Hall
    img11: "./assets/img11.webp", // Docs
};

/**
 * Attempts to load an image into its designated frame.
 * If the image exists, it hides the placeholder overlay.
 */
function applyImages() {
    Object.keys(CHURCH_IMAGES).forEach(id => {
        const frame = document.getElementById(`${id}-frame`);
        if (frame) {
            const imgPath = CHURCH_IMAGES[id];

            // Create the image element
            const img = document.createElement('img');
            img.src = imgPath;
            img.alt = id;

            // If image loads successfully, hide placeholder and add img to frame
            img.onload = () => {
                const overlay = frame.querySelector('.placeholder-overlay');
                if (overlay) overlay.style.display = 'none';
                frame.appendChild(img);
            };

            // If image fails to load, we just leave the placeholder visible
            img.onerror = () => {
                console.log(`Resource ${imgPath} not found. Keeping placeholder ${id}.`);
            };
        }
    });
}
