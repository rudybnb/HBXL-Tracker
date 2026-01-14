import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Mail, Phone } from "lucide-react";

export default function ContractorSuccess() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-green-400">Application Submitted Successfully!</h1>
          <p className="text-slate-400 mt-1">ER Build & Design - Contractor Registration</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6">
        <Card className="bg-slate-900 border-green-500">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
            
            <h2 className="text-2xl font-bold text-green-400 mb-4">
              Thank You for Your Application!
            </h2>
            
            <p className="text-slate-300 text-lg mb-8">
              Your contractor registration has been submitted successfully. 
              Our team will review your application and get back to you within 24 hours.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-center space-x-3 bg-slate-800 p-4 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-400" />
                <div className="text-left">
                  <h3 className="font-medium text-white">Review Time</h3>
                  <p className="text-slate-400 text-sm">Within 24 hours</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-slate-800 p-4 rounded-lg">
                <Mail className="w-6 h-6 text-blue-400" />
                <div className="text-left">
                  <h3 className="font-medium text-white">We'll Contact You</h3>
                  <p className="text-slate-400 text-sm">Via email & Telegram</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-600 rounded-lg p-6">
              <h3 className="text-yellow-400 font-medium mb-3">What's Next?</h3>
              <ul className="text-slate-300 text-left space-y-2">
                <li>• We'll verify your documentation and credentials</li>
                <li>• Complete a brief phone interview if needed</li>
                <li>• Get approved and start receiving job assignments</li>
                <li>• Begin earning with ER Build & Design</li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-600">
              <p className="text-slate-400 mb-2">Questions or concerns?</p>
              <div className="flex items-center justify-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400">07534251548</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400">admin@erbuild.co.uk</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}