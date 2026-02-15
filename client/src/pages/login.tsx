import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // FORCE CLEAR ALL DATA ON EVERY LOGIN ATTEMPT
    localStorage.clear();
    sessionStorage.clear();
    
    // Check admin credentials first
    if (username === "admin" && password === "admin123") {
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('adminName', "Admin");
      console.log('✅ Admin login successful - role set to admin');
      window.location.href = '/admin';
      toast({
        title: "Login Successful",
        description: "Welcome back, Admin!",
      });
      return;
    }
    
    // Check contractor credentials from database
    try {
      const response = await fetch('/api/contractor-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const contractor = await response.json();
        
        // Successful contractor login
        localStorage.setItem('userRole', 'contractor');
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('contractorName', `${contractor.firstName} ${contractor.lastName}`);
        localStorage.setItem('contractorId', contractor.id);
        console.log(`✅ Contractor login successful - ${contractor.firstName} ${contractor.lastName}`);
        window.location.href = '/';
        toast({
          title: "Login Successful",
          description: `Welcome back, ${contractor.firstName}!`,
        });
        
      } else {
        // Fallback to legacy contractor login
        if (username === "contractor" && password === "contractor123") {
          localStorage.setItem('userRole', 'contractor');
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('contractorName', 'Dalwayne Diedericks');
          console.log('✅ Legacy contractor login successful - Dalwayne Diedericks');
          window.location.href = '/';
          toast({
            title: "Login Successful",
            description: "Welcome back, Dalwayne!",
          });
        } else {
          toast({
            title: "Login Failed",
            description: "Invalid username or password",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: "Unable to connect to server",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 opacity-90"></div>
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, rgba(203, 213, 224, 0.15) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }}></div>
      
      <div className="relative w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          
          {/* Left side - Branding */}
          <div className="text-left space-y-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-yellow-600 rounded-xl flex items-center justify-center shadow-2xl">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white">ERdesignandbuild</h1>
                  <p className="text-amber-400 font-medium">GPS Time Tracking & Job Management</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side - Login Form */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md bg-slate-700 border-slate-600 shadow-2xl">
              <CardHeader className="text-center space-y-2 pb-6">
                <CardTitle className="text-2xl font-bold text-white">Welcome Back</CardTitle>
                <CardDescription className="text-slate-400 text-base">
                  Sign in to access your dashboard
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-slate-200 font-medium">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500 h-12"
                      placeholder="Enter username"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-200 font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500 h-12 pr-12"
                        placeholder="Enter password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-medium h-12 text-base shadow-lg transition-all duration-200"
                  >
Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}