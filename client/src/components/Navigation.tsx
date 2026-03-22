import { useLocation } from "wouter";
import { Link } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { label: "首页", href: "/" },
    { label: "作品", href: "/portfolio" },
    { label: "实验室", href: "/lab" },
    { label: "博客", href: "/blog" },
    { label: "关于", href: "/about" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-8 pointer-events-none">
      <div className="pointer-events-auto">
        <div className="text-xs font-bold tracking-widest font-mono text-text-main">
          FEZER_PORTFOLIO // 01
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
