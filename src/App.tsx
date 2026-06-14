import { useState } from "react";
import "./App.css";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { Home } from "./pages/home/Home";
import { Profile } from "./pages/profile/Profile";

type AuthPage =
  | "forgot-password"
  | "home"
  | "login"
  | "profile"
  | "register"
  | "reset-password";

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const hasStoredAuth = () =>
  Boolean(
    localStorage.getItem(AUTH_SESSION_KEY) ||
      sessionStorage.getItem(AUTH_SESSION_KEY) ||
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_KEY),
  );

const getResetToken = () => {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("reset_token") ?? searchParams.get("token");
};

const getInitialAuthPage = (): AuthPage => {
  if (getResetToken()) {
    return "reset-password";
  }

  return "home";
};

const clearResetTokenFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("reset_token");
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url);
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasStoredAuth());
  const [resetToken, setResetToken] = useState<string | null>(() => getResetToken());
  const [authPage, setAuthPage] = useState<AuthPage>(() => getInitialAuthPage());

  const goToLogin = () => {
    clearResetTokenFromUrl();
    setResetToken(null);
    setAuthPage("login");
  };

  const clearAuthSession = () => {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        credentials: "include",
        method: "POST",
      });
    } finally {
      clearAuthSession();
      setIsAuthenticated(false);
      setAuthPage("home");
    }
  };

  const handleAuthAction = () => {
    if (isAuthenticated) {
      void handleLogout();
      return;
    }

    goToLogin();
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setAuthPage("home");
  };

  if (authPage === "home") {
    return (
      <Home
        isAuthenticated={isAuthenticated}
        onAuthAction={handleAuthAction}
        onOpenProfile={() =>
          isAuthenticated ? setAuthPage("profile") : goToLogin()
        }
      />
    );
  }

  if (authPage === "profile") {
    return (
      <Profile
        isAuthenticated={isAuthenticated}
        onAuthAction={handleAuthAction}
        onBackHome={() => setAuthPage("home")}
      />
    );
  }

  if (authPage === "forgot-password") {
    return <ForgotPassword onBackToLogin={goToLogin} />;
  }

  if (authPage === "reset-password") {
    return (
      <ResetPassword
        onBackToLogin={goToLogin}
        onResetSuccess={goToLogin}
        token={resetToken}
      />
    );
  }

  return (
    <>
      {authPage === "login" ? (
        <Login
          onForgotPassword={() => setAuthPage("forgot-password")}
          onLoginSuccess={handleAuthenticated}
          onSwitchToRegister={() => setAuthPage("register")}
        />
      ) : (
        <Register
          onRegisterSuccess={handleAuthenticated}
          onSwitchToLogin={() => setAuthPage("login")}
        />
      )}
    </>
  );
}

export default App;
