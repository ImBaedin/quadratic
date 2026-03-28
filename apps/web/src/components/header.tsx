import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

export default function Header() {
  const { user, loading } = useAuth();
  const links = [
    { to: "/", label: "Home" },
    { to: "/onboarding", label: "Onboarding" },
  ] as const;

  return (
    <div className="border-b border-zinc-800 bg-black/70">
      <div className="mx-auto flex max-w-6xl flex-row items-center justify-between px-4 py-4">
        <Link to="/" className="text-sm uppercase tracking-[0.3em] text-zinc-500">
          Quadratic
        </Link>
        <nav className="flex gap-4 text-sm text-zinc-300">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to} className="[&.active]:text-white">
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          {loading ? <span className="text-zinc-600">Loading...</span> : null}
          {!loading && user ? <span className="text-zinc-500">{user.email}</span> : null}
          {!loading && user ? (
            <a href="/logout" className="text-zinc-500">
              Logout
            </a>
          ) : (
            <Link to="/login" className="text-zinc-500">
              Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
