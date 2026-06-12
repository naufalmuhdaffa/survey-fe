import { useState } from "react";
import "./App.css";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { Home } from "./pages/home/Home";

type AuthPage = "home" | "login" | "register";

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";

const hasStoredAuth = () =>
  Boolean(
    localStorage.getItem(AUTH_SESSION_KEY) ||
      sessionStorage.getItem(AUTH_SESSION_KEY) ||
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_KEY),
  );

function App() {
  const [authPage, setAuthPage] = useState<AuthPage>(() =>
    hasStoredAuth() ? "home" : "login",
  );

  if (authPage === "home") {
    return <Home onLogout={() => setAuthPage("login")} />;
  }

  return (
    <>
      {authPage === "login" ? (
        <Login
          onLoginSuccess={() => setAuthPage("home")}
          onSwitchToRegister={() => setAuthPage("register")}
        />
      ) : (
        <Register
          onRegisterSuccess={() => setAuthPage("home")}
          onSwitchToLogin={() => setAuthPage("login")}
        />
      )}
    </>
  );
}

export default App;
