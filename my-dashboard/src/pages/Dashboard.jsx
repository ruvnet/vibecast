import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useTheme } from "@/store/theme";
import {
  Activity, AlertTriangle, BarChart3, Battery, Cpu,
  Gauge, Globe, LifeBuoy, Rocket, Shield, Users, Zap
} from "lucide-react";

export default function Dashboard() {
  const { theme, isAlertMode } = useTheme();
  const isAlert = theme === 'dark';
  
  // Simulated ship data
  const shipData = {
    speed: "Warp 5.3",
    shields: isAlert ? "42%" : "87%",
    power: isAlert ? "68%" : "92%",
    lifeSupportStatus: isAlert ? "CRITICAL" : "NOMINAL",
    crewCount: "142",
    temperature: isAlert ? "38.2°C" : "21.5°C"
  };

  // Simulated ship logs
  const shipLogs = [
    {
      id: 1,
      message: isAlert ? "Hull breach detected on Deck 7" : "Routine maintenance completed on warp core",
      timestamp: "12:42:18",
      priority: isAlert ? "high" : "low"
    },
    {
      id: 2,
      message: isAlert ? "Life support failing in Sector 3" : "Long-range sensors calibrated",
      timestamp: "12:38:05",
      priority: isAlert ? "critical" : "medium"
    },
    {
      id: 3,
      message: isAlert ? "Shields at critical levels" : "Course plotted to Alpha Centauri",
      timestamp: "12:36:47",
      priority: isAlert ? "high" : "low"
    }
  ];

  return (
    <div className="container mx-auto py-6">
      {/* Command Header */}
      <div className="flex justify-between items-center mb-6 border-b border-border/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-wider flex items-center gap-2">
            <Rocket className="h-8 w-8 text-primary" />
            <span>COMMAND CONSOLE</span>
          </h1>
          <p className="text-muted-foreground text-sm tracking-wide">
            STARDATE: {new Date().toISOString().slice(0, 10).replace(/-/g, '.')}.{Math.floor(Math.random() * 10)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${isAlert ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-primary/20 text-primary'}`}>
            {isAlert ? 'RED ALERT' : 'SYSTEMS NOMINAL'}
          </div>
          <Button asChild variant="outline" size="sm" className="font-space text-xs">
            <Link to="/">RETURN TO BRIDGE</Link>
          </Button>
        </div>
      </div>

      {/* Ship Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden relative">
          <div className={`absolute inset-0 ${isAlert ? 'bg-destructive/5' : 'bg-primary/5'} border-l-4 ${isAlert ? 'border-destructive' : 'border-primary'}`}></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className={`h-5 w-5 ${isAlert ? 'text-destructive' : 'text-primary'}`} />
              <span>SHIELD SYSTEMS</span>
            </CardTitle>
            <CardDescription>Defensive capabilities</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-4xl font-mono font-bold">{shipData.shields}</p>
              <div className={`w-16 h-16 rounded-full ${isAlert ? 'bg-destructive/20' : 'bg-primary/20'} flex items-center justify-center`}>
                <Shield className={`h-8 w-8 ${isAlert ? 'text-destructive' : 'text-primary'}`} />
              </div>
            </div>
            <div className={`h-2 mt-4 rounded-full bg-muted overflow-hidden`}>
              <div
                className={`h-full ${isAlert ? 'bg-destructive animate-pulse' : 'bg-primary'} rounded-full`}
                style={{ width: shipData.shields }}
              ></div>
            </div>
          </CardContent>
          <CardFooter className="relative z-10">
            <Button variant="ghost" size="sm" className="text-xs">SHIELD MODULATION</Button>
          </CardFooter>
        </Card>

        <Card className="border border-secondary/20 bg-card/80 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-secondary/5 border-l-4 border-secondary"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-5 w-5 text-secondary" />
              <span>POWER SYSTEMS</span>
            </CardTitle>
            <CardDescription>Energy allocation</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-4xl font-mono font-bold">{shipData.power}</p>
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                <Battery className="h-8 w-8 text-secondary" />
              </div>
            </div>
            <div className="h-2 mt-4 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-secondary rounded-full"
                style={{ width: shipData.power }}
              ></div>
            </div>
          </CardContent>
          <CardFooter className="relative z-10">
            <Button variant="ghost" size="sm" className="text-xs">POWER DISTRIBUTION</Button>
          </CardFooter>
        </Card>

        <Card className="border border-accent/20 bg-card/80 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-accent/5 border-l-4 border-accent"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              <span>CREW STATUS</span>
            </CardTitle>
            <CardDescription>Personnel monitoring</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-4xl font-mono font-bold">{shipData.crewCount}</p>
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <LifeBuoy className="h-8 w-8 text-accent" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="text-xs">
                <span className="text-muted-foreground">LIFE SUPPORT:</span>
                <span className={`ml-2 font-medium ${isAlert ? 'text-destructive' : 'text-accent'}`}>{shipData.lifeSupportStatus}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">TEMPERATURE:</span>
                <span className="ml-2 font-medium">{shipData.temperature}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="relative z-10">
            <Button variant="ghost" size="sm" className="text-xs">CREW MANIFEST</Button>
          </CardFooter>
        </Card>
      </div>

      {/* Ship Systems Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: <Gauge className="h-5 w-5" />, name: "PROPULSION", status: shipData.speed },
          { icon: <Globe className="h-5 w-5" />, name: "NAVIGATION", status: "ONLINE" },
          { icon: <Cpu className="h-5 w-5" />, name: "COMPUTER", status: "OPERATIONAL" },
          { icon: <BarChart3 className="h-5 w-5" />, name: "SENSORS", status: isAlert ? "DEGRADED" : "OPTIMAL" },
        ].map((system, i) => (
          <Card key={i} className="bg-card/60 backdrop-blur-sm border-border/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
                  {system.icon}
                </div>
                <div>
                  <p className="text-xs font-medium">{system.name}</p>
                  <p className={`text-sm font-mono ${isAlert && system.status === "DEGRADED" ? "text-destructive" : ""}`}>
                    {system.status}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ship Logs */}
      <Card className="mb-6 border-border/30 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span>SHIP LOGS</span>
          </CardTitle>
          <CardDescription>Recent system notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shipLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 p-3 border rounded-lg ${
                  log.priority === 'critical' ? 'border-destructive/50 bg-destructive/10' :
                  log.priority === 'high' ? 'border-destructive/30 bg-destructive/5' :
                  'border-border/30 bg-muted/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  log.priority === 'critical' ? 'bg-destructive text-destructive-foreground' :
                  log.priority === 'high' ? 'bg-destructive/20 text-destructive' :
                  'bg-muted/30 text-muted-foreground'
                }`}>
                  {log.priority === 'critical' || log.priority === 'high' ?
                    <AlertTriangle className="h-4 w-4" /> :
                    <Activity className="h-4 w-4" />
                  }
                </div>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${
                    log.priority === 'critical' ? 'text-destructive' : ''
                  }`}>
                    {log.message}
                  </p>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {log.timestamp}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" className="text-xs">ACCESS FULL LOGS</Button>
        </CardFooter>
      </Card>
      
      {/* Command Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" className="border-primary/30 hover:border-primary/50 text-xs">SCAN NEARBY SYSTEMS</Button>
        <Button variant="outline" className="border-secondary/30 hover:border-secondary/50 text-xs">COMMUNICATIONS ARRAY</Button>
        <Button variant={isAlert ? "destructive" : "outline"} className={isAlert ? "" : "border-accent/30 hover:border-accent/50"} size="sm">
          {isAlert ? "INITIATE EMERGENCY PROTOCOLS" : "SHIP DIAGNOSTICS"}
        </Button>
      </div>
    </div>
  );
}
