import { useLocation } from "wouter";
import { Link } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { label: "HOME", href: "/" },
    { label: "PORTFOLIO", href: "/portfolio" },
    { label: "LAB", href: "/lab" },
    { label: "BLOG", href: "/blog" },
    { label: "ABOUT", href: "/about" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-8 pointer-events-none">
      <div className="pointer-events-auto">
        <div className="text-xs font-bold tracking-widest font-mono text-text-main">
          KINETIC_PORTFOLIO // 01
        </div>
      </div>

      <div className="flex gap-8 pointer-events-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <a
              className={`nav-link ${
                location === item.href ? "text-accent-lava" : ""
              }`}
            >
              {item.label}
            </a>
          </Link>
        ))}
      </div>
    </nav>
  );
}
