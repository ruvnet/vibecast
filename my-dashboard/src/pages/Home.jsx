import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Rocket, Star, Gauge, AlertTriangle } from "lucide-react";
import { useTheme } from "@/store/theme";

export default function Home() {
  const [showMessage, setShowMessage] = useState(false);
  const { theme } = useTheme();
  const isAlert = theme === 'dark';
  
  const handleWelcomeClick = () => {
    setShowMessage(true);
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-3xl">
        <div className="flex justify-center mb-4">
          <Rocket className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-space-blue via-space-teal to-space-purple bg-clip-text text-transparent font-space tracking-wider">
          STARSHIP COMMAND
        </h1>
        <p className="mb-8 text-xl text-muted-foreground font-space">
          {isAlert
            ? "⚠️ RED ALERT: All personnel to battle stations ⚠️"
            : "Welcome aboard, Captain. Systems are ready for your command."}
        </p>
        
        <Card className={`mb-8 border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden relative ${isAlert ? 'border-destructive/20' : ''}`}>
          <div className={`absolute inset-0 ${isAlert ? 'bg-destructive/5' : 'bg-primary/5'} border-l-4 ${isAlert ? 'border-destructive' : 'border-primary'}`}></div>
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center justify-center gap-2 font-space">
              <Star className={`h-5 w-5 ${isAlert ? 'text-destructive' : 'text-primary'}`} />
              <span>BRIDGE CONTROL</span>
              <Star className={`h-5 w-5 ${isAlert ? 'text-destructive' : 'text-primary'}`} />
            </CardTitle>
            <CardDescription>Stellar Fleet Command Interface</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              <p className="text-lg font-space">
                This advanced interface provides control over all ship systems.
                {isAlert && (
                  <span className="block mt-2 text-destructive font-medium">
                    WARNING: Multiple systems reporting critical failures.
                  </span>
                )}
              </p>
              {showMessage && (
                <div className={`mt-4 p-4 rounded-md border ${
                  isAlert
                    ? 'bg-destructive/10 border-destructive/30 text-destructive-foreground'
                    : 'bg-primary/10 border-primary/30 text-primary-foreground'
                }`}>
                  <div className="flex items-center gap-2">
                    {isAlert
                      ? <AlertTriangle className="h-5 w-5 text-destructive" />
                      : <Star className="h-5 w-5 text-primary" />
                    }
                    <span className="font-mono">
                      {isAlert
                        ? "EMERGENCY PROTOCOLS ACTIVATED"
                        : "COMMAND AUTHORIZATION ACCEPTED"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-4 relative z-10">
            <Button
              onClick={handleWelcomeClick}
              className={`font-space text-xs ${isAlert ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            >
              {isAlert ? "EMERGENCY OVERRIDE" : "COMMAND AUTHORIZATION"}
            </Button>
            <Button variant="outline" asChild className="font-space text-xs">
              <Link to="/dashboard" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                <span>ACCESS COMMAND CONSOLE</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
        
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: <Star className="h-4 w-4" />, label: "STELLAR CARTOGRAPHY" },
            { icon: <Rocket className="h-4 w-4" />, label: "PROPULSION SYSTEMS" },
            { icon: <AlertTriangle className="h-4 w-4" />, label: "SECURITY PROTOCOLS" },
          ].map((item, i) => (
            <Button key={i} variant="outline" size="sm" className="text-xs font-space">
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{item.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}