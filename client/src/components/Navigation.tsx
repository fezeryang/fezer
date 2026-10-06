import { useLocation } from "wouter";
import { Link } from "wouter";

type NavigationProps = {
  variant?: "default" | "editorial";
};

export default function Navigation({ variant = "default" }: NavigationProps) {
  const [location] = useLocation();
  const isEditorial = variant === "editorial";

  const isItemActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }

    return location === href || location.startsWith(`${href}/`);
  };

  const navItems = [
    { label: "首页", href: "/" },
    { label: "作品", href: "/portfolio" },
    { label: "实验室", href: "/lab" },
    { label: "博客", href: "/blog" },
    { label: "关于", href: "/about" },
  ];

  return (
    <nav
      className={`site-navigation fixed top-0 left-0 right-0 z-50 flex justify-center sm:justify-end items-center px-3 py-4 sm:p-8 pointer-events-none ${
        isEditorial ? "navigation--editorial" : ""
      }`}
      aria-label="主导航"
    >
      <div
        className={`site-navigation__items flex gap-1 sm:gap-8 pointer-events-auto ${
          isEditorial ? "navigation__items" : ""
        }`}
      >
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isItemActive(item.href) ? "page" : undefined}
            className={`nav-link ${
              isItemActive(item.href) ? "nav-link--active text-accent-lava" : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
