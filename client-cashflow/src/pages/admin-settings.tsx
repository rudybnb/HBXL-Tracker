import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get Saturday overtime setting
  const { data: saturdayOvertimeSetting, isLoading } = useQuery({
    queryKey: ["/api/admin-settings/saturday_overtime"],
    queryFn: async () => {
      const response = await fetch("/api/admin-settings/saturday_overtime");
      if (response.status === 404) return null; // Setting doesn't exist
      if (!response.ok) throw new Error('Failed to fetch Saturday overtime setting');
      return response.json();
    },
    retry: false,
  });

  // Get Sunday overtime setting
  const { data: sundayOvertimeSetting, isLoading: sundayLoading } = useQuery({
    queryKey: ["/api/admin-settings/sunday_overtime"],
    queryFn: async () => {
      const response = await fetch("/api/admin-settings/sunday_overtime");
      if (response.status === 404) return null; // Setting doesn't exist
      if (!response.ok) throw new Error('Failed to fetch Sunday overtime setting');
      return response.json();
    },
    retry: false,
  });

  // Mutation to update Saturday overtime setting
  const updateSaturdayOvertimeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const settingData = {
        settingKey: 'saturday_overtime',
        settingValue: enabled.toString(),
        description: 'Allow contractors to work overtime on Saturdays',
        updatedBy: 'Admin'
      };

      const response = await fetch('/api/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingData)
      });
      if (!response.ok) throw new Error('Failed to update Saturday overtime setting');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-settings/saturday_overtime"] });
      toast({
        title: "Setting Updated",
        description: "Saturday overtime setting has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update Saturday overtime setting. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Mutation to update Sunday overtime setting
  const updateSundayOvertimeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const settingData = {
        settingKey: 'sunday_overtime',
        settingValue: enabled.toString(),
        description: 'Allow contractors to work overtime on Sundays',
        updatedBy: 'Admin'
      };

      const response = await fetch('/api/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingData)
      });
      if (!response.ok) throw new Error('Failed to update Sunday overtime setting');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-settings/sunday_overtime"] });
      toast({
        title: "Setting Updated",
        description: "Sunday overtime setting has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update Sunday overtime setting. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleToggleSaturdayOvertime = (enabled: boolean) => {
    updateSaturdayOvertimeMutation.mutate(enabled);
  };

  const handleToggleSundayOvertime = (enabled: boolean) => {
    updateSundayOvertimeMutation.mutate(enabled);
  };

  const saturdayCurrentlyEnabled = saturdayOvertimeSetting?.settingValue === 'true';
  const sundayCurrentlyEnabled = sundayOvertimeSetting?.settingValue === 'true';

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">⚙️</span>
          </div>
          <h1 className="text-2xl font-bold text-yellow-400">Admin Settings</h1>
        </div>
        <p className="text-slate-400">Configure system settings for contractor management</p>
      </div>

      {/* Saturday Overtime Setting Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-yellow-400 flex items-center space-x-2">
                <span>Saturday Overtime</span>
                {saturdayCurrentlyEnabled && <Badge className="bg-green-600 text-white">ENABLED</Badge>}
                {!saturdayCurrentlyEnabled && <Badge className="bg-red-600 text-white">DISABLED</Badge>}
              </CardTitle>
              <CardDescription className="text-slate-400">
                Allow contractors to clock in and work overtime on Saturdays
              </CardDescription>
            </div>
            <Switch
              checked={saturdayCurrentlyEnabled}
              onCheckedChange={handleToggleSaturdayOvertime}
              disabled={isLoading || updateSaturdayOvertimeMutation.isPending}
              className="data-[state=checked]:bg-yellow-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              <div className="font-semibold text-yellow-400 mb-2">Current Configuration:</div>
              <ul className="space-y-1 text-slate-400">
                <li>• Regular Hours: Monday-Friday, 7:45 AM - 5:00 PM</li>
                <li>• Saturday Overtime: {saturdayCurrentlyEnabled ? 'Allowed' : 'Not Allowed'}</li>
                <li>• Sunday Overtime: {sundayCurrentlyEnabled ? 'Allowed' : 'Not Allowed'}</li>
                <li>• GPS Validation: 1km radius required for all work sessions</li>
              </ul>
            </div>

            {saturdayCurrentlyEnabled && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="text-yellow-400 font-semibold mb-1">⚠️ Saturday Overtime Active</div>
                <div className="text-sm text-slate-300">
                  Contractors can now clock in on Saturdays during regular hours (7:45 AM - 5:00 PM).
                  All GPS and location validation rules still apply.
                </div>
              </div>
            )}

            {!saturdayCurrentlyEnabled && (
              <div className="p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
                <div className="text-slate-400 text-sm">
                  Saturday work is currently disabled. Contractors cannot clock in on Saturdays.
                </div>
              </div>
            )}

            {saturdayOvertimeSetting?.updatedAt && (
              <div className="text-xs text-slate-500">
                Last updated: {new Date(saturdayOvertimeSetting.updatedAt).toLocaleString()} by {saturdayOvertimeSetting.updatedBy}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sunday Overtime Setting Card */}
      <Card className="bg-slate-800 border-slate-700 mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-yellow-400 flex items-center space-x-2">
                <span>Sunday Overtime</span>
                {sundayCurrentlyEnabled && <Badge className="bg-green-600 text-white">ENABLED</Badge>}
                {!sundayCurrentlyEnabled && <Badge className="bg-red-600 text-white">DISABLED</Badge>}
              </CardTitle>
              <CardDescription className="text-slate-400">
                Allow contractors to clock in and work overtime on Sundays
              </CardDescription>
            </div>
            <Switch
              checked={sundayCurrentlyEnabled}
              onCheckedChange={handleToggleSundayOvertime}
              disabled={sundayLoading || updateSundayOvertimeMutation.isPending}
              className="data-[state=checked]:bg-yellow-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              <div className="font-semibold text-yellow-400 mb-2">Current Configuration:</div>
              <ul className="space-y-1 text-slate-400">
                <li>• Regular Hours: Monday-Friday, 7:45 AM - 5:00 PM</li>
                <li>• Saturday Overtime: {saturdayCurrentlyEnabled ? 'Allowed' : 'Not Allowed'}</li>
                <li>• Sunday Overtime: {sundayCurrentlyEnabled ? 'Allowed' : 'Not Allowed'}</li>
                <li>• GPS Validation: 1km radius required for all work sessions</li>
              </ul>
            </div>

            {sundayCurrentlyEnabled && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="text-yellow-400 font-semibold mb-1">⚠️ Sunday Overtime Active</div>
                <div className="text-sm text-slate-300">
                  Contractors can now clock in on Sundays during regular hours (7:45 AM - 5:00 PM).
                  All GPS and location validation rules still apply.
                </div>
              </div>
            )}

            {!sundayCurrentlyEnabled && (
              <div className="p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
                <div className="text-slate-400 text-sm">
                  Sunday work is currently disabled. Contractors cannot clock in on Sundays.
                </div>
              </div>
            )}

            {sundayOvertimeSetting?.updatedAt && (
              <div className="text-xs text-slate-500">
                Last updated: {new Date(sundayOvertimeSetting.updatedAt).toLocaleString()} by {sundayOvertimeSetting.updatedBy}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}