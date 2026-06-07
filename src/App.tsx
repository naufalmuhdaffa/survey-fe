import { useState } from "react";
import "./App.css";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";

function App() {
  const [authPage, setAuthPage] = useState<"login" | "register">("login");

  return (
    <>
      {authPage === "login" ? (
        <Login onSwitchToRegister={() => setAuthPage("register")} />
      ) : (
        <Register onSwitchToLogin={() => setAuthPage("login")} />
      )}
    </>
  );
}

export default App;
