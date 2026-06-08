import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Music, BookOpen, Heart, Menu, X, Lightbulb, Wand2, LogOut, Timer, Waves } from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";
import { motion, AnimatePresence } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { favoritesCount } = useFavorites();
  const { cifrasCount } = useCifrasFavoritas();
  const totalFavoritos = favoritesCount + cifrasCount;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useClerk();

  const handleSignOut = () => {
    setMobileMenuOpen(false);
    signOut({ redirectUrl: basePath || "/" });
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "/dicionario", label: "Dicionário", icon: Music },
    { href: "/aplicacoes", label: "Aplicações", icon: Lightbulb },
    { href: "/sofisticador", label: "Sofisticador", icon: Wand2 },
    { href: "/metronomo", label: "Metrônomo", icon: Timer },
    { href: "/pad", label: "Pad", icon: Waves },
    { href: "/estudo", label: "Modo Estudo", icon: BookOpen },
    { href: "/favoritos", label: "Favoritos", icon: Heart, badge: totalFavoritos },
  ];

  const NavLink = ({ item, onClick }: { item: (typeof navItems)[number]; onClick?: () => void }) => {
    const active = location === item.href;
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
        )}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />}
        <item.icon className={cn("w-5 h-5 shrink-0 transition-transform duration-200", !active && "group-hover:scale-110")} />
        <span className="flex-1">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col gap-1 bg-surface/80 backdrop-blur-xl border-r border-white/5 px-3 py-5">
        <Link href="/" className="flex items-center px-2 py-3 outline-none rounded-xl">
          <img
            src={`${basePath}/harmonic-logo-horizontal.png`}
            alt="Harmonic"
            className="h-12 w-auto select-none transition-opacity hover:opacity-90"
            draggable={false}
          />
        </Link>

        <nav className="flex flex-col gap-1 mt-3">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="mt-auto pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all outline-none"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className={cn(
          "md:hidden sticky top-0 z-50 transition-all duration-300",
          isScrolled ? "glass border-b border-white/5" : "bg-background/70 backdrop-blur-md border-b border-transparent"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <Link href="/" className="flex items-center outline-none">
            <img
              src={`${basePath}/harmonic-logo-horizontal.png`}
              alt="Harmonic"
              className="h-9 w-auto select-none"
              draggable={false}
            />
          </Link>
          <button
            className="p-2 rounded-lg text-muted-foreground hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-nav-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden fixed top-16 inset-x-0 z-40 glass border-b border-white/10 overflow-hidden"
          >
            <div className="px-4 py-5 space-y-1.5 flex flex-col">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setMobileMenuOpen(false)} />
              ))}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all w-full text-left"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content column */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>

        <footer className="border-t border-white/5 py-8 mt-12 bg-surface/40">
          <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground text-sm flex flex-col items-center gap-4">
            <img
              src={`${basePath}/logo.png`}
              alt="Harmonic"
              className="w-8 h-8 rounded-lg opacity-70"
            />
            <p>© {new Date().getFullYear()} Harmonic. Uma ferramenta para tecladistas.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
