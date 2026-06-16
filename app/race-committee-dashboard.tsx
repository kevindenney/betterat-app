import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from '@/components/ui';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Wind,
  Navigation,
  Thermometer,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Play,
  Flag,
  Download,
  Eye,
  FileText,
  Mail,
  BarChart2,
  Plus,
  Trophy,
  Bell
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const RaceCommitteeDashboard = () => {
  // Mock data for the dashboard
  const [countdown, setCountdown] = useState({ days: 2, hours: 14, minutes: 32, seconds: 18 });
  
  // Simulate countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Quick stats data
  const quickStats = {
    upcomingRaces: 5,
    pendingEntries: 12,
    activeRaces: 3,
    unpublishedResults: 2
  };

  // Next regatta data
  const nextRegatta = {
    name: "RHKYC Spring Series 2025 - Race 1",
    date: "May 18, 2025",
    time: "14:00",
    location: "Victoria Harbour, Hong Kong",
    preparationChecklist: [
      { id: 1, title: "Course setup", status: "completed" },
      { id: 2, title: "Safety briefing", status: "pending" },
      { id: 3, title: "Entry verification", status: "incomplete" },
      { id: 4, title: "Weather analysis", status: "completed" },
      { id: 5, title: "Briefing document", status: "pending" }
    ],
    entryProgress: { current: 15, total: 20 },
    weather: {
      wind: "12-16kt NE",
      gusts: "18kt",
      temp: "24°C"
    }
  };

  // Active races data (for race day)
  const activeRace = {
    name: "RHKYC Spring Series R1",
    elapsedTime: "00:42:18",
    fleetStatus: {
      onCourse: 18,
      finished: 7,
      dnf: 2,
      retired: 1
    },
    currentLeaders: [
      { position: 1, boat: "SUI777", time: "00:38:22" },
      { position: 2, boat: "GBR123", time: "00:38:55" },
      { position: 3, boat: "HKG456", time: "00:39:12" }
    ],
    course: "Triangle - Windward-Leeward",
    conditions: {
      wind: "14kt NE",
      current: "0.5kt E"
    }
  };

  // Pending tasks data
  const pendingTasks = [
    { id: 1, title: "Review regatta safety protocols", dueDate: "Today", urgency: "urgent" },
    { id: 2, title: "Send reminder to late entries", dueDate: "Today", urgency: "urgent" },
    { id: 3, title: "Prepare course diagram for next race", dueDate: "May 17", urgency: "thisWeek" },
    { id: 4, title: "Update club website with race results", dueDate: "May 20", urgency: "upcoming" },
    { id: 5, title: "Schedule fleet meeting", dueDate: "May 22", urgency: "upcoming" }
  ];

  // Recent results data
  const recentResults = [
    {
      id: 1,
      raceName: "RHKYC Winter Series R5",
      date: "Apr 15, 2025",
      boatClass: "Dragon Class",
      boatCount: 22,
      winner: "HKG789",
      publicationStatus: "published",
      views: 142,
      downloads: 28
    },
    {
      id: 2,
      raceName: "RHKYC Spring Series Qualifier",
      date: "Apr 10, 2025",
      boatClass: "J/80 Class",
      boatCount: 18,
      winner: "SUI456",
      publicationStatus: "draft",
      views: 89,
      downloads: 15
    }
  ];

  // Fleet activity summary
  const fleetActivity = {
    racingActivity: {
      last30Days: 24,
      avgEntriesPerRace: 18,
      participationRate: "78%"
    },
    fleetGrowth: {
      newMembers: 12,
      totalMembers: 142,
      growthRate: "9.2%"
    },
    topPerformers: [
      { position: 1, boat: "HKG789", points: 98 },
      { position: 2, boat: "GBR123", points: 92 },
      { position: 3, boat: "SUI456", points: 87 }
    ]
  };

  // Quick actions data
  const quickActions = [
    { id: 1, title: "Create New Race", icon: <Plus color="#007AFF" size={24} /> },
    { id: 2, title: "Publish Documents", icon: <FileText color="#007AFF" size={24} /> },
    { id: 3, title: "Score Results", icon: <Trophy color="#007AFF" size={24} /> },
    { id: 4, title: "Email Fleet", icon: <Mail color="#007AFF" size={24} /> },
    { id: 5, title: "Manage Entries", icon: <Users color="#007AFF" size={24} /> },
    { id: 6, title: "View Analytics", icon: <BarChart2 color="#007AFF" size={24} /> }
  ];

  // Helper function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle color="#10B981" size={16} />;
      case "pending":
        return <AlertTriangle color="#F59E0B" size={16} />;
      case "incomplete":
        return <X color="#EF4444" size={16} />;
      default:
        return null;
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "incomplete":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // Helper function to get task urgency color
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "urgent":
        return "bg-red-100 border-red-500";
      case "thisWeek":
        return "bg-orange-100 border-orange-500";
      case "upcoming":
        return "bg-green-100 border-green-500";
      default:
        return "bg-gray-100 border-gray-300";
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-white text-2xl font-bold">RHKYC</Text>
          <TouchableOpacity className="bg-blue-700 p-2 rounded-full">
            <Bell color="white" size={24} />
          </TouchableOpacity>
        </View>
        <Text className="text-blue-200">Victoria Harbour, Hong Kong</Text>
      </View>

      {/* Quick Stats */}
      <View className="flex-row px-4 py-3 bg-white">
        <View className="flex-1 items-center">
          <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mb-1">
            <Flag color="#007AFF" size={16} />
          </View>
          <Text className="text-gray-900 font-bold">{quickStats.upcomingRaces}</Text>
          <Text className="text-gray-500 text-xs">Upcoming</Text>
        </View>
        <View className="flex-1 items-center">
          <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center mb-1">
            <Users color="#F59E0B" size={16} />
          </View>
          <Text className="text-gray-900 font-bold">{quickStats.pendingEntries}</Text>
          <Text className="text-gray-500 text-xs">Pending</Text>
        </View>
        <View className="flex-1 items-center">
          <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mb-1">
            <Play color="#10B981" size={16} />
          </View>
          <Text className="text-gray-900 font-bold">{quickStats.activeRaces}</Text>
          <Text className="text-gray-500 text-xs">Active</Text>
        </View>
        <View className="flex-1 items-center">
          <View className="w-8 h-8 rounded-full bg-yellow-100 items-center justify-center mb-1">
            <FileText color="#F59E0B" size={16} />
          </View>
          <Text className="text-gray-900 font-bold">{quickStats.unpublishedResults}</Text>
          <Text className="text-gray-500 text-xs">Unpublished</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {/* Next Regatta Hero Card */}
        <View className="bg-white rounded-xl shadow-md mb-4 overflow-hidden">
          <Image 
            source={{ uri: "https://images.unsplash.com/photo-1558281050-4c33200099c7?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2F0ZXIlMjBzcG9ydHN8ZW58MHx8MHx8fDA%3D" }} 
            style={{ width: width - 32, height: 160 }}
            resizeMode="cover"
          />
          <View className="p-4">
            <Text className="text-lg font-bold mb-2">{nextRegatta.name}</Text>
            
            <View className="flex-row items-center mb-2">
              <Calendar color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-2">{nextRegatta.date} at {nextRegatta.time}</Text>
            </View>
            
            <View className="flex-row items-center mb-3">
              <MapPin color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-2">{nextRegatta.location}</Text>
            </View>
            
            {/* Countdown Timer - Tufte compact format */}
            <View className="bg-blue-50 p-3 rounded-lg mb-4">
              <Text className="text-blue-800 font-bold text-center">
                {countdown.days > 0 ? `${countdown.days}d ${countdown.hours}h` : `${countdown.hours}h ${countdown.minutes}m`} until start
              </Text>
            </View>
            
            {/* Preparation Checklist */}
            <Text className="font-bold mb-2">Preparation Checklist</Text>
            <View className="mb-4">
              {nextRegatta.preparationChecklist.map((item) => (
                <View key={item.id} className="flex-row items-center mb-2">
                  {getStatusIcon(item.status)}
                  <Text className={`ml-2 ${getStatusColor(item.status)}`}>
                    {item.title}
                  </Text>
                </View>
              ))}
            </View>
            
            {/* Entry Progress */}
            <Text className="font-bold mb-2">
              Entry Progress: {nextRegatta.entryProgress.current} of {nextRegatta.entryProgress.total} boats
            </Text>
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-2 bg-gray-200 rounded-full mr-2">
                <View 
                  className="h-2 bg-blue-600 rounded-full" 
                  style={{ width: `${(nextRegatta.entryProgress.current / nextRegatta.entryProgress.total) * 100}%` }}
                />
              </View>
              <Text className="text-gray-600 text-sm">
                {Math.round((nextRegatta.entryProgress.current / nextRegatta.entryProgress.total) * 100)}%
              </Text>
            </View>
            
            {/* Weather Forecast */}
            <Text className="font-bold mb-2">Weather Forecast</Text>
            <View className="flex-row mb-4">
              <View className="flex-row items-center mr-4">
                <Wind color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-1">{nextRegatta.weather.wind}</Text>
              </View>
              <View className="flex-row items-center mr-4">
                <Navigation color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-1">Gusts {nextRegatta.weather.gusts}</Text>
              </View>
              <View className="flex-row items-center">
                <Thermometer color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-1">{nextRegatta.weather.temp}</Text>
              </View>
            </View>
            
            {/* Quick Action Buttons */}
            <View className="flex-row mb-4">
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mr-2">
                <Text className="text-white font-bold">Review Entries</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mr-2">
                <Text className="text-white font-bold">Set Course</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-white font-bold">Send Briefing</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity className="flex-row items-center justify-center">
              <Text className="text-blue-600 font-bold">View Full Details</Text>
              <ChevronRight color="#007AFF" size={16} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Active Races Card (Conditional) */}
        <View className="bg-white rounded-xl shadow-md mb-4 overflow-hidden">
          <View className="bg-green-500 p-3">
            <Text className="text-white font-bold">ACTIVE RACE</Text>
          </View>
          <View className="p-4">
            <Text className="text-lg font-bold mb-2">{activeRace.name}</Text>
            
            <View className="flex-row items-center mb-3">
              <Clock color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-2">Elapsed: {activeRace.elapsedTime}</Text>
            </View>
            
            {/* Fleet Status */}
            <Text className="font-bold mb-2">Fleet Status</Text>
            <View className="flex-row justify-between mb-4">
              <View className="items-center">
                <Text className="text-blue-600 font-bold">{activeRace.fleetStatus.onCourse}</Text>
                <Text className="text-gray-500 text-xs">On Course</Text>
              </View>
              <View className="items-center">
                <Text className="text-green-600 font-bold">{activeRace.fleetStatus.finished}</Text>
                <Text className="text-gray-500 text-xs">Finished</Text>
              </View>
              <View className="items-center">
                <Text className="text-yellow-600 font-bold">{activeRace.fleetStatus.dnf}</Text>
                <Text className="text-gray-500 text-xs">DNF</Text>
              </View>
              <View className="items-center">
                <Text className="text-red-600 font-bold">{activeRace.fleetStatus.retired}</Text>
                <Text className="text-gray-500 text-xs">Retired</Text>
              </View>
            </View>
            
            {/* Current Leaders */}
            <Text className="font-bold mb-2">Current Leaders</Text>
            {activeRace.currentLeaders.map((leader) => (
              <View key={leader.position} className="flex-row justify-between py-1 border-b border-gray-100">
                <Text className="font-bold">#{leader.position} {leader.boat}</Text>
                <Text className="text-gray-600">{leader.time}</Text>
              </View>
            ))}
            
            {/* Course Information */}
            <View className="my-3">
              <Text className="font-bold mb-1">Course: {activeRace.course}</Text>
              <View className="flex-row">
                <View className="flex-row items-center mr-4">
                  <Wind color="#6B7280" size={16} />
                  <Text className="text-gray-600 ml-1">{activeRace.conditions.wind}</Text>
                </View>
                <View className="flex-row items-center">
                  <Navigation color="#6B7280" size={16} />
                  <Text className="text-gray-600 ml-1">{activeRace.conditions.current}</Text>
                </View>
              </View>
            </View>
            
            {/* Action Buttons */}
            <View className="flex-row mt-2">
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mr-2">
                <Text className="text-white font-bold">View Race Control</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-green-600 flex-1 py-3 rounded-lg items-center mr-2">
                <Text className="text-white font-bold">Record Finish</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-red-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-white font-bold">Emergency Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Pending Tasks Card */}
        <View className="bg-white rounded-xl shadow-md mb-4 p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold">Pending Tasks</Text>
            <TouchableOpacity>
              <ChevronRight color="#6B7280" size={20} />
            </TouchableOpacity>
          </View>
          
          {pendingTasks.map((task) => (
            <View 
              key={task.id} 
              className={`flex-row items-center p-3 mb-2 rounded-lg border ${getUrgencyColor(task.urgency)}`}
            >
              <View className="flex-1">
                <Text className="font-bold">{task.title}</Text>
                <Text className="text-gray-600 text-sm">Due: {task.dueDate}</Text>
              </View>
              <ChevronRight color="#6B7280" size={16} />
            </View>
          ))}
          
          <View className="flex-row mt-2">
            <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mr-2">
              <Text className="text-white font-bold">View All Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity className="border border-blue-600 flex-1 py-3 rounded-lg items-center">
              <Text className="text-blue-600 font-bold">Delegate</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Recent Results Card */}
        <View className="bg-white rounded-xl shadow-md mb-4 p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold">Recent Results</Text>
            <TouchableOpacity>
              <ChevronRight color="#6B7280" size={20} />
            </TouchableOpacity>
          </View>
          
          {recentResults.map((result) => (
            <View key={result.id} className="mb-4 pb-4 border-b border-gray-100">
              <View className="flex-row justify-between mb-2">
                <Text className="font-bold">{result.raceName}</Text>
                <View className={`px-2 py-1 rounded-full ${result.publicationStatus === 'published' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <Text className={`text-xs ${result.publicationStatus === 'published' ? 'text-green-800' : 'text-yellow-800'}`}>
                    {result.publicationStatus}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row mb-2">
                <Text className="text-gray-600 mr-3">{result.date}</Text>
                <Text className="text-gray-600 mr-3">•</Text>
                <Text className="text-gray-600 mr-3">{result.boatClass}</Text>
                <Text className="text-gray-600">•</Text>
                <Text className="text-gray-600 ml-3">{result.boatCount} boats</Text>
              </View>
              
              <View className="flex-row items-center mb-2">
                <Trophy color="#F59E0B" size={16} />
                <Text className="text-gray-600 ml-2">Winner: {result.winner}</Text>
              </View>
              
              <View className="flex-row mb-3">
                <View className="flex-row items-center mr-4">
                  <Eye color="#6B7280" size={16} />
                  <Text className="text-gray-600 ml-1">{result.views} views</Text>
                </View>
                <View className="flex-row items-center">
                  <Download color="#6B7280" size={16} />
                  <Text className="text-gray-600 ml-1">{result.downloads} downloads</Text>
                </View>
              </View>
              
              <View className="flex-row">
                <TouchableOpacity className="bg-blue-600 py-2 px-3 rounded-lg mr-2">
                  <Text className="text-white text-sm">View</Text>
                </TouchableOpacity>
                <TouchableOpacity className="border border-gray-300 py-2 px-3 rounded-lg">
                  <Text className="text-gray-600 text-sm">Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
        
        {/* Fleet Activity Summary */}
        <View className="bg-white rounded-xl shadow-md mb-4 p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold">Fleet Activity Summary</Text>
            <TouchableOpacity>
              <ChevronRight color="#6B7280" size={20} />
            </TouchableOpacity>
          </View>
          
          <View className="mb-4">
            <Text className="font-bold mb-2">Last 30 Days</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-600">Races:</Text>
              <Text className="font-bold">{fleetActivity.racingActivity.last30Days}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-600">Avg Entries:</Text>
              <Text className="font-bold">{fleetActivity.racingActivity.avgEntriesPerRace}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Participation Rate:</Text>
              <Text className="font-bold">{fleetActivity.racingActivity.participationRate}</Text>
            </View>
          </View>
          
          <View className="mb-4">
            <Text className="font-bold mb-2">Fleet Growth</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-600">New Members:</Text>
              <Text className="font-bold text-green-600">+{fleetActivity.fleetGrowth.newMembers}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-600">Total Members:</Text>
              <Text className="font-bold">{fleetActivity.fleetGrowth.totalMembers}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Growth Rate:</Text>
              <Text className="font-bold text-green-600">{fleetActivity.fleetGrowth.growthRate}</Text>
            </View>
          </View>
          
          <View>
            <Text className="font-bold mb-2">Top Performers</Text>
            {fleetActivity.topPerformers.map((performer) => (
              <View key={performer.position} className="flex-row justify-between py-1">
                <Text className="font-bold">#{performer.position} {performer.boat}</Text>
                <Text className="text-gray-600">{performer.points} pts</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity className="mt-4 py-3 bg-blue-50 rounded-lg items-center">
            <Text className="text-blue-600 font-bold">View Detailed Analytics</Text>
          </TouchableOpacity>
        </View>
        
        {/* Quick Actions Grid */}
        <View className="bg-white rounded-xl shadow-md p-4 mb-4">
          <Text className="text-lg font-bold mb-3">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-between">
            {quickActions.map((action) => (
              <TouchableOpacity 
                key={action.id} 
                className="w-[30%] items-center py-4 mb-3 bg-blue-50 rounded-lg"
              >
                {action.icon}
                <Text className="text-blue-600 mt-2 text-center text-sm">{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default RaceCommitteeDashboard;