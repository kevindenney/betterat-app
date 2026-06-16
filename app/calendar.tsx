import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, TextInput as RNTextInput } from 'react-native';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  MapPin,
  Clock,
  Users,
  FileText,
  MoreVertical,
  X,
  Sun,
  Navigation,
  Copy,
  Flag,
  Mail
} from 'lucide-react-native';

type EventStatus = 'confirmed' | 'draft' | 'completed' | 'cancelled';
type EventType = 'series' | 'championship' | 'club';
type FilterType = 'all' | EventType;
type ViewMode = 'month' | 'week' | 'day' | 'list';

type OfficialStatus = 'confirmed' | 'pending';
type DocumentStatus = 'published' | 'draft';

interface EventOfficial {
  name: string;
  role: string;
  status: OfficialStatus;
}

interface EventDocument {
  name: string;
  status: DocumentStatus;
}

interface EventCommunication {
  sender: string;
  message: string;
  time: string;
}

interface EventWeather {
  wind: string;
  gusts: string;
  temp: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  type: EventType;
  entryCount: number;
  entryLimit: number;
  pendingPayments: number;
  course: string;
  laps: number;
  marks: string;
  timeLimit: string;
  officials: EventOfficial[];
  documents: EventDocument[];
  weather: EventWeather;
  communications: EventCommunication[];
}

type RegattaTemplateType = EventType | 'custom';

interface RegattaTemplate {
  id: RegattaTemplateType;
  title: string;
  description: string;
  type: RegattaTemplateType;
}

const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'RHKYC Spring Series R1',
    date: '2025-05-18',
    startTime: '14:00',
    endTime: '17:00',
    status: 'confirmed',
    type: 'series',
    entryCount: 18,
    entryLimit: 24,
    pendingPayments: 2,
    course: 'Triangle - Windward-Leeward',
    laps: 3,
    marks: 'B, W, G',
    timeLimit: '2h 30m',
    officials: [
      { name: 'John Smith', role: 'Principal Race Officer', status: 'confirmed' },
      { name: 'Sarah Johnson', role: 'Assistant Race Officer', status: 'pending' },
      { name: 'Michael Lee', role: 'Protest Hearing', status: 'confirmed' }
    ],
    documents: [
      { name: 'Notice of Race', status: 'published' },
      { name: 'Sailing Instructions', status: 'draft' },
      { name: 'Course Diagram', status: 'published' }
    ],
    weather: { wind: '12-16kt NE', gusts: '18kt', temp: '24°C' },
    communications: [
      { sender: 'Race Committee', message: 'Course will be set 30 minutes before start', time: '09:30 AM' },
      { sender: 'Club Secretary', message: 'Reminder: Entry deadline extended to May 17', time: '11:15 AM' }
    ]
  },
  {
    id: '2',
    title: 'RHKYC Dragon Championship',
    date: '2025-05-22',
    startTime: '13:00',
    endTime: '18:00',
    status: 'draft',
    type: 'championship',
    entryCount: 12,
    entryLimit: 20,
    pendingPayments: 3,
    course: 'Trapezoid - Olympic Triangle',
    laps: 2,
    marks: 'A, B, C',
    timeLimit: '3h',
    officials: [
      { name: 'Robert Davis', role: 'Principal Race Officer', status: 'pending' },
      { name: 'Emma Wilson', role: 'Assistant Race Officer', status: 'pending' }
    ],
    documents: [
      { name: 'Notice of Race', status: 'published' },
      { name: 'Sailing Instructions', status: 'published' }
    ],
    weather: { wind: '15-20kt E', gusts: '25kt', temp: '26°C' },
    communications: []
  },
  {
    id: '3',
    title: 'Club Social Regatta',
    date: '2025-05-25',
    startTime: '10:00',
    endTime: '16:00',
    status: 'completed',
    type: 'club',
    entryCount: 22,
    entryLimit: 30,
    pendingPayments: 0,
    course: 'Windward-Leeward',
    laps: 1,
    marks: 'W, L',
    timeLimit: '1h 30m',
    officials: [
      { name: 'David Brown', role: 'Principal Race Officer', status: 'confirmed' },
      { name: 'Lisa Chen', role: 'Assistant Race Officer', status: 'confirmed' }
    ],
    documents: [
      { name: 'Notice of Race', status: 'published' },
      { name: 'Sailing Instructions', status: 'published' },
      { name: 'Results', status: 'published' }
    ],
    weather: { wind: '8-12kt S', gusts: '15kt', temp: '28°C' },
    communications: [
      { sender: 'Race Committee', message: 'Results published. Congratulations to all participants!', time: '04:30 PM' }
    ]
  }
];

// Template data for creating new regattas
const templates: RegattaTemplate[] = [
  {
    id: 'series',
    title: 'Series Race Template',
    description: 'Standard series race with multiple days',
    type: 'series'
  },
  {
    id: 'championship',
    title: 'Championship Event Template',
    description: 'High-level championship event with special requirements',
    type: 'championship'
  },
  {
    id: 'custom',
    title: 'Custom Regatta',
    description: 'Build your own regatta from scratch',
    type: 'custom'
  }
];

const VIEW_MODES: ViewMode[] = ['month', 'week', 'day', 'list'];
const FILTER_OPTIONS: FilterType[] = ['all', 'series', 'championship', 'club'];

const CalendarScreen = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateRegattaModal, setShowCreateRegattaModal] = useState(false);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return mockEvents.filter((event) => {
      const matchesFilter = filter === 'all' || event.type === filter;
      const matchesQuery =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.course.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [filter, searchQuery]);

  // Get days in month for calendar grid
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateString = date.toISOString().split('T')[0];
    return filteredEvents.filter((event) => event.date === dateString);
  };

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Format month and year for display
  const formatMonthYear = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Render calendar grid
  const renderCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<View key={`empty-${i}`} className="h-16 border border-gray-200" />);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const events = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      
      days.push(
        <TouchableOpacity
          key={day}
          className={`h-16 border border-gray-200 p-1 ${isToday ? 'bg-blue-50' : ''}`}
          onPress={() => {
            if (events.length > 0) {
              setSelectedEvent(events[0]);
              setShowEventModal(true);
            }
          }}
        >
          <Text className={`text-right text-sm ${isToday ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
            {day}
          </Text>
          <View className="flex-row flex-wrap mt-1">
            {events.slice(0, 3).map((event, index) => (
              <View 
                key={index} 
                className={`w-2 h-2 rounded-full mr-1 mb-1 ${
                  event.status === 'confirmed' ? 'bg-blue-500' :
                  event.status === 'draft' ? 'bg-yellow-500' :
                  event.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            ))}
            {events.length > 3 && (
              <Text className="text-xs text-gray-500">+{events.length - 3}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }
    
    return days;
  };

  // Render event list
  const renderEventList = () => {
    return (
      <FlatList<CalendarEvent>
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            className="bg-white rounded-xl shadow-sm p-4 mb-3"
            onPress={() => {
              setSelectedEvent(item);
              setShowEventModal(true);
            }}
          >
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-lg font-bold">{item.title}</Text>
              <View className={`px-2 py-1 rounded-full ${
                item.status === 'confirmed' ? 'bg-blue-100' :
                item.status === 'draft' ? 'bg-yellow-100' :
                item.status === 'completed' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Text className={`text-xs ${
                  item.status === 'confirmed' ? 'text-blue-800' :
                  item.status === 'draft' ? 'text-yellow-800' :
                  item.status === 'completed' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-center mb-2">
              <Calendar color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-2">
                {new Date(item.date).toLocaleDateString()} • {item.startTime} - {item.endTime}
              </Text>
            </View>
            
            <View className="flex-row items-center mb-3">
              <MapPin color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-2">{item.course}</Text>
            </View>
            
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Users color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-1">{item.entryCount}/{item.entryLimit} entries</Text>
              </View>
              
              <TouchableOpacity className="flex-row items-center">
                <MoreVertical color="#6B7280" size={20} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    );
  };

  // Render event detail modal
  const renderEventModal = () => {
    if (!selectedEvent) return null;
    
    return (
      <Modal
        visible={showEventModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEventModal(false)}
      >
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="bg-blue-600 pt-12 pb-4 px-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-xl font-bold">{selectedEvent.title}</Text>
              <TouchableOpacity 
                onPress={() => setShowEventModal(false)}
                className="bg-blue-700 p-2 rounded-full"
              >
                <X color="white" size={20} />
              </TouchableOpacity>
            </View>
            
            <View className={`px-3 py-1 rounded-full self-start mt-2 ${
              selectedEvent.status === 'confirmed' ? 'bg-blue-500' :
              selectedEvent.status === 'draft' ? 'bg-yellow-500' :
              selectedEvent.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <Text className="text-white text-xs">
                {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
              </Text>
            </View>
          </View>
          
          <ScrollView className="flex-1 px-4 py-4">
            {/* Date and Time */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Calendar color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Date & Time</Text>
              </View>
              
              <View className="flex-row items-center mb-1">
                <Text className="text-gray-600 ml-1">
                  {new Date(selectedEvent.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
              </View>
              
              <View className="flex-row items-center">
                <Clock color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-2">{selectedEvent.startTime} - {selectedEvent.endTime}</Text>
              </View>
            </View>
            
            {/* Classes and Divisions */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Flag color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Classes & Divisions</Text>
              </View>
              
              <View className="flex-row flex-wrap">
                <View className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-blue-800">Dragon Class</Text>
                </View>
                <View className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-blue-800">J/80 Class</Text>
                </View>
                <View className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-blue-800">Laser Class</Text>
                </View>
              </View>
            </View>
            
            {/* Entry Statistics */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Users color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Entry Statistics</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-gray-600">Registered:</Text>
                <Text className="font-bold">{selectedEvent.entryCount}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-gray-600">Entry Limit:</Text>
                <Text className="font-bold">{selectedEvent.entryLimit}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Pending Payments:</Text>
                <Text className="font-bold text-yellow-600">{selectedEvent.pendingPayments}</Text>
              </View>
            </View>
            
            {/* Course Details */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Navigation color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Course Details</Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Course Type:</Text>
                <Text className="font-bold">{selectedEvent.course}</Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Laps:</Text>
                <Text className="font-bold">{selectedEvent.laps}</Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Marks:</Text>
                <Text className="font-bold">{selectedEvent.marks}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Time Limit:</Text>
                <Text className="font-bold">{selectedEvent.timeLimit}</Text>
              </View>
            </View>
            
            {/* Officials Roster */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Users color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Officials Roster</Text>
              </View>
              
              {selectedEvent.officials.map((official, index) => (
                <View key={index} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <View>
                    <Text className="font-bold">{official.name}</Text>
                    <Text className="text-gray-600 text-sm">{official.role}</Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${
                    official.status === 'confirmed' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    <Text className={`text-xs ${
                      official.status === 'confirmed' ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {official.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            
            {/* Documents */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <FileText color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Documents</Text>
              </View>
              
              {selectedEvent.documents.map((doc, index) => (
                <View key={index} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <Text className="font-medium">{doc.name}</Text>
                  <View className={`px-2 py-1 rounded-full ${
                    doc.status === 'published' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    <Text className={`text-xs ${
                      doc.status === 'published' ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {doc.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            
            {/* Weather Forecast */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Sun color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Weather Forecast</Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Wind:</Text>
                <Text className="font-bold">{selectedEvent.weather.wind}</Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Gusts:</Text>
                <Text className="font-bold">{selectedEvent.weather.gusts}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Temperature:</Text>
                <Text className="font-bold">{selectedEvent.weather.temp}</Text>
              </View>
            </View>
            
            {/* Communications History */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Mail color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Communications</Text>
              </View>
              
              {selectedEvent.communications.length > 0 ? (
                selectedEvent.communications.map((comm, index) => (
                  <View key={index} className="py-2 border-b border-gray-100">
                    <View className="flex-row justify-between mb-1">
                      <Text className="font-bold">{comm.sender}</Text>
                      <Text className="text-gray-500 text-sm">{comm.time}</Text>
                    </View>
                    <Text className="text-gray-600">{comm.message}</Text>
                  </View>
                ))
              ) : (
                <Text className="text-gray-500 text-center py-2">No communications yet</Text>
              )}
            </View>
            
            {/* Action Buttons */}
            <View className="flex-row flex-wrap mb-6">
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mb-3 mr-2">
                <Text className="text-white font-bold">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mb-3 mr-2">
                <Text className="text-white font-bold">Manage Entries</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center mb-3">
                <Text className="text-white font-bold">Publish Documents</Text>
              </TouchableOpacity>
              <TouchableOpacity className="border border-red-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-red-600 font-bold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Render create regatta modal
  const renderCreateRegattaModal = () => {
    return (
      <Modal
        visible={showCreateRegattaModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateRegattaModal(false)}
      >
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="bg-blue-600 pt-12 pb-4 px-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-xl font-bold">Create New Regatta</Text>
              <TouchableOpacity 
                onPress={() => setShowCreateRegattaModal(false)}
                className="bg-blue-700 p-2 rounded-full"
              >
                <X color="white" size={20} />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView className="flex-1 px-4 py-4">
            {/* Template Cards */}
            <Text className="text-lg font-bold mb-4">Choose a Template</Text>
            
            {templates.map((template) => (
              <TouchableOpacity 
                key={template.id}
                className="bg-white rounded-xl shadow-sm p-4 mb-4"
                onPress={() => {
                  // Handle template selection
                  setShowCreateRegattaModal(false);
                  // Navigate to create regatta screen with template
                }}
              >
                <Text className="text-lg font-bold mb-1">{template.title}</Text>
                <Text className="text-gray-600 mb-3">{template.description}</Text>
                <View className="flex-row justify-end">
                  <Text className="text-blue-600 font-bold">Select</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {/* Additional Options */}
            <View className="mt-6">
              <TouchableOpacity className="flex-row items-center justify-center bg-white rounded-xl shadow-sm p-4 mb-3">
                <Copy color="#007AFF" size={20} />
                <Text className="text-blue-600 font-bold ml-2">Duplicate Last Regatta</Text>
              </TouchableOpacity>
              
              <TouchableOpacity className="flex-row items-center justify-center bg-white rounded-xl shadow-sm p-4">
                <FileText color="#007AFF" size={20} />
                <Text className="text-blue-600 font-bold ml-2">Copy from Template Library</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-4 px-4">
        <Text className="text-white text-2xl font-bold mb-2">Event Calendar</Text>
        <Text className="text-blue-200">Manage regattas and racing events</Text>
      </View>
      
      {/* Top Controls */}
      <View className="bg-white px-4 py-3 shadow-sm">
        {/* View Switcher */}
        <View className="flex-row mb-3">
          {VIEW_MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              className={`px-3 py-2 rounded-lg mr-2 ${
                viewMode === mode ? 'bg-blue-600' : 'bg-gray-100'
              }`}
              onPress={() => setViewMode(mode)}
            >
              <Text
                className={`font-medium ${
                  viewMode === mode ? 'text-white' : 'text-gray-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Filter and Search */}
        <View className="flex-row items-center mb-3">
          <View className="flex-row flex-1 bg-gray-100 rounded-lg px-3 py-2 mr-2">
            <Search color="#6B7280" size={20} />
            <RNTextInput
              placeholder="Search events..."
              className="flex-1 ml-2 text-gray-700"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <TouchableOpacity className="bg-gray-100 rounded-lg p-2 mr-2">
            <Filter color="#6B7280" size={20} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-blue-600 rounded-lg p-2"
            onPress={() => setShowCreateRegattaModal(true)}
          >
            <Plus color="white" size={20} />
          </TouchableOpacity>
        </View>
        
        {/* Filter Dropdown */}
        <View className="flex-row mb-2">
          {FILTER_OPTIONS.map((filterType) => (
            <TouchableOpacity
              key={filterType}
              className={`px-3 py-1 rounded-full mr-2 ${
                filter === filterType ? 'bg-blue-100' : 'bg-gray-100'
              }`}
              onPress={() => setFilter(filterType)}
            >
              <Text
                className={`text-xs ${
                  filter === filterType ? 'text-blue-800' : 'text-gray-700'
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Calendar View */}
      {viewMode === 'month' && (
        <ScrollView className="flex-1 px-4 py-4">
          {/* Month Navigation */}
          <View className="flex-row justify-between items-center mb-4">
            <TouchableOpacity onPress={prevMonth}>
              <ChevronLeft color="#007AFF" size={24} />
            </TouchableOpacity>
            <Text className="text-lg font-bold">{formatMonthYear(currentDate)}</Text>
            <TouchableOpacity onPress={nextMonth}>
              <ChevronRight color="#007AFF" size={24} />
            </TouchableOpacity>
          </View>
          
          {/* Weekday Headers */}
          <View className="flex-row mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <View key={day} className="flex-1 items-center">
                <Text className="font-bold text-gray-600">{day}</Text>
              </View>
            ))}
          </View>
          
          {/* Calendar Grid */}
          <View className="flex-row flex-wrap">
            {renderCalendarGrid()}
          </View>
          
          {/* Legend */}
          <View className="mt-6">
            <Text className="font-bold mb-2">Legend</Text>
            <View className="flex-row flex-wrap">
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-blue-500 mr-1" />
                <Text className="text-gray-700 text-sm">Confirmed</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-yellow-500 mr-1" />
                <Text className="text-gray-700 text-sm">Draft/Planning</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-red-500 mr-1" />
                <Text className="text-gray-700 text-sm">Today</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-green-500 mr-1" />
                <Text className="text-gray-700 text-sm">Completed</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
      
      {/* List View */}
      {viewMode === 'list' && (
        <View className="flex-1 px-4 py-4">
          {renderEventList()}
        </View>
      )}
      
      {/* Other views would go here */}
      {viewMode === 'week' && (
        <View className="flex-1 px-4 py-4">
          <Text className="text-gray-700 text-base font-semibold mb-3">
            Week View
          </Text>
          {renderEventList()}
        </View>
      )}
      
      {viewMode === 'day' && (
        <View className="flex-1 px-4 py-4">
          <Text className="text-gray-700 text-base font-semibold mb-3">
            Day View
          </Text>
          {renderEventList()}
        </View>
      )}
      
      {/* Modals */}
      {renderEventModal()}
      {renderCreateRegattaModal()}
    </View>
  );
};

export default CalendarScreen;
