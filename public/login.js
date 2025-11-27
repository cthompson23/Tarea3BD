// login.js

const form = document.getElementById("loginForm");
const mensajeLogin = document.getElementById("mensajeLogin");
const btnLogin = document.getElementById("btnLogin");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        mensajeLogin.textContent = "Complete todos los campos.";
        mensajeLogin.style.color = "#e74c3c";
        return;
    }

    // Loading visual
    btnLogin.innerHTML = "⏳ Iniciando sesión...";
    btnLogin.disabled = true;
    mensajeLogin.textContent = "";

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!data.success) {
            mensajeLogin.textContent = data.message || "Credenciales incorrectas.";
            mensajeLogin.style.color = "#e74c3c";
        } else {
            mensajeLogin.textContent = "✅ Ingreso exitoso. Redirigiendo...";
            mensajeLogin.style.color = "#2ecc71";

            localStorage.setItem("adminUser", JSON.stringify(data.user));

            setTimeout(() => {
                window.location.href = "index.html";
            }, 800);
        }

    } catch (err) {
        console.error(err);
        mensajeLogin.textContent = "Error de conexión con el servidor.";
        mensajeLogin.style.color = "#e74c3c";
    } finally {
        btnLogin.innerHTML = "Iniciar sesión";
        btnLogin.disabled = false;
    }
});
