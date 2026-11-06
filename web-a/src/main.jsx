import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import keycloak from "./keycloak.js";
import "./App.css";
import "./auth.css";
import {monitorSession} from '../../shared/sso.js';

const root = ReactDOM.createRoot(document.getElementById("root"));

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Employee Portal render failed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="auth-screen">
          <section className="auth-status-card">
            <span className="auth-mark auth-mark-error">!</span>
            <div className="eyebrow">IAM ZERO TRUST · EMPLOYEE PORTAL</div>
            <h1>Không thể hiển thị trang</h1>
            <p>Trang chưa hiển thị được đầy đủ. Hãy tải lại để kết nối và lấy dữ liệu mới nhất.</p>
            <div className="auth-actions">
              <button onClick={() => window.location.reload()}>Tải lại trang</button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function renderAuthStatus(title, message, failed = false) {
  root.render(
    <main className="auth-screen">
      <section className="auth-status-card">
        <span className={`auth-mark${failed ? " auth-mark-error" : ""}`}>{failed ? "!" : "I"}</span>
        <div className="eyebrow">IAM ZERO TRUST · EMPLOYEE PORTAL</div>
        <h1>{title}</h1>
        <p>{message}</p>
        {failed && (
          <div className="auth-actions">
            <button onClick={() => keycloak.login()}>Thử đăng nhập lại</button>
            <button className="auth-secondary" onClick={() => window.location.reload()}>Tải lại trang</button>
          </div>
        )}
      </section>
    </main>,
  );
}

async function startApp() {
  renderAuthStatus("Đang kết nối Keycloak", "Đang kiểm tra phiên đăng nhập và chuyển đến trang xác thực…");
  try {
    const initialized = await Promise.race([
      keycloak.init({
        onLoad: "login-required",
        pkceMethod: "S256",
        checkLoginIframe: false,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Keycloak không phản hồi trong 20 giây.")), 20000)),
    ]);
    if (!initialized) throw new Error("Keycloak chưa xác thực phiên đăng nhập.");
    root.render(<AppErrorBoundary><App /></AppErrorBoundary>);
    monitorSession({keycloak,apiUrl:import.meta.env.VITE_API_URL || 'http://localhost:3001',onEnded:message=>renderAuthStatus('Phiên đăng nhập đã kết thúc',message,true)});
  } catch (error) {
    console.error("Keycloak initialization failed", error);
    renderAuthStatus(
      "Chưa kết nối được Keycloak",
      error.message || "Kiểm tra Keycloak tại localhost:8080 rồi thử lại.",
      true,
    );
  }
}

startApp();
