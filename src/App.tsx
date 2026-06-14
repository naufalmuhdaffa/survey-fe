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

  return hasStoredAuth() ? "home" : "login";
};

const clearResetTokenFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("reset_token");
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url);
};

function App() {
  const [resetToken, setResetToken] = useState<string | null>(() => getResetToken());
  const [authPage, setAuthPage] = useState<AuthPage>(() => getInitialAuthPage());

  const goToLogin = () => {
    clearResetTokenFromUrl();
    setResetToken(null);
    setAuthPage("login");
  };

  if (authPage === "home") {
    return (
      <Home
        onLogout={() => setAuthPage("login")}
        onOpenProfile={() => setAuthPage("profile")}
      />
    );
  }

  if (authPage === "profile") {
    return (
      <Profile
        onBackHome={() => setAuthPage("home")}
        onLogout={() => setAuthPage("login")}
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
