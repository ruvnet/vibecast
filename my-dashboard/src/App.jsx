import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import { useTheme } from './store/theme';
import { Button } from './components/ui/button';
import { Rocket, Gauge, Home as HomeIcon } from 'lucide-react';

function App() {
  const { theme, isAlertMode } = useTheme();

  return (
    <div className={theme}>
      <div className="min-h-screen bg-background text-foreground font-space">
        <Router>
          <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="container mx-auto py-3 px-4 flex justify-between items-center">
              <Link to="/" className="text-xl font-bold flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
                <Rocket className="h-6 w-6" />
                <span className="tracking-wider">STARSHIP COMMAND</span>
              </Link>
              <div className="flex items-center gap-4">
                <nav className="hidden md:flex items-center gap-6">
                  <Link
                    to="/"
                    className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span>BRIDGE</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Gauge className="h-4 w-4" />
                    <span>COMMAND CONSOLE</span>
                  </Link>
                </nav>
              </div>
            </div>
          </header>
          
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </main>
          
          <footer className="border-t border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 md:flex md:items-center md:justify-between py-4">
              <p className="text-center md:text-left text-sm text-muted-foreground">
                © {new Date().getFullYear()} STARSHIP COMMAND • STELLAR FLEET
              </p>
              <div className="mt-4 md:mt-0 flex justify-center md:justify-end space-x-6">
                <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  SHIP MANIFEST
                </a>
                <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  STELLAR CARTOGRAPHY
                </a>
              </div>
            </div>
          </footer>
          
          <ThemeToggle />
        </Router>
      </div>
    </div>
  );
}

export default App;