import CalendarMapView from '@/components/calendar/MapView';
import { EmptyState } from '@/components/ui/empty';
import { useSailorDashboardData } from '@/hooks';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plane,
  Search,
  X
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width: _width } = Dimensions.get('window');

// Memoized Event Card Component
// eslint-disable-next-line react/display-name
const EventCard = React.memo(({ event, onPress }: { event: any; onPress: () => void }) => {
  const getEventColor = (type: string) => {
    switch (type) {
      case 'registered': return 'bg-blue-500';
      case 'available': return 'bg-green-500';
      case 'travel': return 'bg-orange-500';
      case 'training': return 'bg-purple-500';
      case 'social': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm p-4 mb-3"
      onPress={onPress}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-bold">{event.title}</Text>
          <Text className="text-gray-600 text-sm">{event.boatClass}</Text>
        </View>
        <View className={`w-3 h-3 rounded-full ${getEventColor(event.type)}`} />
      </View>

      <View className="flex-row items-center mb-2">
        <Calendar color="#6B7280" size={16} />
        <Text className="text-gray-600 ml-2">
          {new Date(event.date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
          })} • {event.startTime}
        </Text>
      </View>

      <View className="flex-row items-center mb-2">
        <MapPin color="#6B7280" size={16} />
        <Text className="text-gray-600 ml-2">{event.venue}</Text>
      </View>

      <View className="flex-row items-center mb-3">
        <Navigation color="#6B7280" size={16} />
        <Text className="text-gray-600 ml-2">{event.distance} km away</Text>
        {event.distance > 50 && <Plane color="#F59E0B" size={16} className="ml-2" />}
      </View>

      {event.registrationStatus && (
        <View className="flex-row items-center mb-2">
          {event.registrationStatus === 'confirmed' ? (
            <CheckCircle color="#10B981" size={16} />
          ) : (
            <AlertTriangle color="#F59E0B" size={16} />
          )}
          <Text className={`ml-2 text-sm ${
            event.registrationStatus === 'confirmed' ? 'text-green-600' : 'text-yellow-600'
          }`}>
            Registration: {event.registrationStatus}
          </Text>
        </View>
      )}

      {event.prepStatus !== undefined && (
        <View>
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-gray-600 text-sm">Prep Status</Text>
            <Text className="text-blue-600 font-bold text-sm">{event.prepStatus}%</Text>
          </View>
          <View className="bg-gray-200 h-2 rounded-full">
            <View className="bg-blue-600 h-2 rounded-full" style={{ width: `${event.prepStatus}%` }} />
          </View>
        </View>
      )}

      {event.entryDeadline && (
        <View className="mt-2 pt-2 border-t border-gray-100">
          <Text className="text-gray-600 text-sm">
            Entry deadline: {new Date(event.entryDeadline).toLocaleDateString()} • {event.entryFee}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const CalendarScreen = () => {
  // Real data hooks
  const { races, loading: racesLoading, error: racesError } = useSailorDashboardData();
  const { savedVenues, homeVenue, isLoading: venuesLoading } = useSavedVenues();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list' | 'map'>('month');
  const [filter, setFilter] = useState('all'); // all, registered, available, travel, training
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState<string | 'all'>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'month' | 'next30'>('all');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // Memoized event selection handler
  const handleEventPress = useCallback((event: any) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  // Get user's current location (use home venue as reference)
  const userLat = (homeVenue?.coordinates?.[1] as number | undefined) || 22.2793; // Default to HK
  const userLon = (homeVenue?.coordinates?.[0] as number | undefined) || 114.1628;

  // Transform races into calendar events format with real venue data
  const events = races.map(race => {
    // Find matching venue from saved venues by name
    const venue = savedVenues.find(v =>
      v.name.toLowerCase().includes(race.venue.toLowerCase()) ||
      race.venue.toLowerCase().includes(v.name.toLowerCase())
    );

    const venueLat = (venue?.coordinates?.[1] as number | undefined) || userLat;
    const venueLon = (venue?.coordinates?.[0] as number | undefined) || userLon;
    const distance = calculateDistance(userLat, userLon, venueLat, venueLon);

    return {
      id: race.id,
      title: race.name,
      date: race.startDate,
      startTime: new Date(race.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      endTime: race.endDate ? new Date(race.endDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : undefined,
      venue: race.venue,
      venueId: venue?.id,
      latitude: venueLat,
      longitude: venueLon,
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      type: (race.status === 'completed' ? 'registered' : race.status === 'in_progress' ? 'registered' : 'available') as 'registered' | 'available' | 'travel' | 'training' | 'social',
      boatClass: race.classId || 'Unknown Class',
      registrationStatus: (race.status === 'completed' || race.status === 'in_progress' ? 'confirmed' : 'pending') as 'confirmed' | 'pending' | 'waitlist',
      prepStatus: race.hasStrategy ? 75 : 25,
      documents: race.documentsReady,
      strategy: race.hasStrategy,
      weather: Math.round(race.weatherConfidence * 100),
      crewConfirmed: race.crewAssigned ? 3 : 0,
      crewTotal: 3,
    };
  });

  // Transform saved venues into map format
  const venuesForMap = savedVenues.map(venue => ({
    id: venue.id,
    name: venue.name,
    latitude: (venue.coordinates?.[1] as number | undefined) || 0,
    longitude: (venue.coordinates?.[0] as number | undefined) || 0,
    isSaved: true,
    isHome: homeVenue?.id === venue.id,
  }));

  // Derived date range from preset
  const { dateFrom, dateTo } = useMemo(() => {
    if (datePreset === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { dateFrom: start, dateTo: end };
    }
    if (datePreset === 'next30') {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      return { dateFrom: start, dateTo: end };
    }
    return { dateFrom: null as Date | null, dateTo: null as Date | null };
  }, [datePreset, currentDate]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // type filter
      const typeOk = filter === 'all' ? true : (
        filter === 'travel' ? (typeof e.distance === 'number' && e.distance > 50) : e.type === filter
      );

      // search filter (title or venue)
      const q = searchQuery.trim().toLowerCase();
      const searchOk = q.length === 0 || e.title.toLowerCase().includes(q) || (e.venue || '').toLowerCase().includes(q);

      // venue filter
      const venueOk = selectedVenueId === 'all' ? true : e.venueId === selectedVenueId;

      // date range filter
      const dateOnly = new Date(e.date);
      dateOnly.setHours(0, 0, 0, 0);
      const fromOk = !dateFrom || dateOnly >= new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
      const toOk = !dateTo || dateOnly <= new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());

      return typeOk && searchOk && venueOk && fromOk && toOk;
    });
  }, [events, filter, searchQuery, selectedVenueId, dateFrom, dateTo]);

  // Get days in month for calendar grid
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return filteredEvents.filter(event => event.date === dateString);
  };

  // Get event color based on type
  const getEventColor = (type: string) => {
    switch (type) {
      case 'registered': return 'bg-blue-500';
      case 'available': return 'bg-green-500';
      case 'travel': return 'bg-orange-500';
      case 'training': return 'bg-purple-500';
      case 'social': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
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

  // Group events for list view
  const groupedEvents: { thisWeekend: any[]; thisMonth: any[]; upcomingTravel: any[] } = {
    thisWeekend: filteredEvents.filter(e => {
      const eventDate = new Date(e.date);
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return eventDate >= today && eventDate <= nextWeek;
    }),
    thisMonth: filteredEvents.filter(e => {
      const eventDate = new Date(e.date);
      const today = new Date();
      return eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
    }),
    upcomingTravel: filteredEvents.filter(e => e.distance && e.distance > 50),
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
                className={`w-2 h-2 rounded-full mr-1 mb-1 ${getEventColor(event.type)}`}
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

  // Render event item using memoized component
  const renderEventItem = useCallback((event: any) => (
    <EventCard
      key={`${event.id}`}
      event={event}
      onPress={() => handleEventPress(event)}
    />
  ), [handleEventPress]);

  // Render grouped list view
  const renderListView = () => (
    <ScrollView className="flex-1 px-4 py-4">
      {groupedEvents.thisWeekend.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Clock color="#007AFF" size={20} />
            <Text className="text-lg font-bold ml-2">This Weekend</Text>
            <Text className="text-gray-500 ml-2">({groupedEvents.thisWeekend.length})</Text>
          </View>
          {groupedEvents.thisWeekend.map(renderEventItem)}
        </View>
      )}

      {groupedEvents.thisMonth.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Calendar color="#007AFF" size={20} />
            <Text className="text-lg font-bold ml-2">This Month</Text>
            <Text className="text-gray-500 ml-2">({groupedEvents.thisMonth.length})</Text>
          </View>
          {groupedEvents.thisMonth.map(renderEventItem)}
        </View>
      )}

      {groupedEvents.upcomingTravel.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Plane color="#F59E0B" size={20} />
            <Text className="text-lg font-bold ml-2">Upcoming Travel (&gt;50km)</Text>
            <Text className="text-gray-500 ml-2">({groupedEvents.upcomingTravel.length})</Text>
          </View>
          {groupedEvents.upcomingTravel.map(renderEventItem)}
        </View>
      )}

            {/* Optional future grouping: season qualifiers */}
    </ScrollView>
  );

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
          <View className="bg-blue-600 pt-12 pb-4 px-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-xl font-bold flex-1">{selectedEvent.title}</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)} className="bg-blue-700 p-2 rounded-full">
                <X color="white" size={20} />
              </TouchableOpacity>
            </View>
            <Text className="text-blue-200 mt-1">{selectedEvent.boatClass}</Text>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {/* Date & Time */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Calendar color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Date & Time</Text>
              </View>
              <Text className="text-gray-600 mb-1">
                {new Date(selectedEvent.date).toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </Text>
              <View className="flex-row items-center">
                <Clock color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-2">{selectedEvent.startTime} - {selectedEvent.endTime}</Text>
              </View>
            </View>

            {/* Venue */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <MapPin color="#007AFF" size={20} />
                <Text className="text-lg font-bold ml-2">Venue</Text>
              </View>
              <Text className="text-gray-800 font-medium mb-2">{selectedEvent.venue}</Text>
              <View className="flex-row items-center">
                <Navigation color="#6B7280" size={16} />
                <Text className="text-gray-600 ml-2">{selectedEvent.distance} km from your location</Text>
              </View>
            </View>

            {/* Registration & Prep */}
            {selectedEvent.registrationStatus && (
              <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <View className="flex-row items-center mb-3">
                  <CheckCircle color="#007AFF" size={20} />
                  <Text className="text-lg font-bold ml-2">Registration & Prep</Text>
                </View>
                <View className={`px-3 py-2 rounded-lg mb-3 ${
                  selectedEvent.registrationStatus === 'confirmed' ? 'bg-green-100' :
                  selectedEvent.registrationStatus === 'pending' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  <Text className={`font-medium ${
                    selectedEvent.registrationStatus === 'confirmed' ? 'text-green-800' :
                    selectedEvent.registrationStatus === 'pending' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    Status: {selectedEvent.registrationStatus.charAt(0).toUpperCase() + selectedEvent.registrationStatus.slice(1)}
                  </Text>
                </View>

                {selectedEvent.prepStatus !== undefined && (
                  <>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-gray-600">Preparation Status</Text>
                      <Text className="text-blue-600 font-bold">{selectedEvent.prepStatus}%</Text>
                    </View>
                    <View className="bg-gray-200 h-2 rounded-full mb-3">
                      <View className="bg-blue-600 h-2 rounded-full" style={{ width: `${selectedEvent.prepStatus}%` }} />
                    </View>

                    <View className="space-y-2">
                      <View className="flex-row items-center">
                        {selectedEvent.documents ? (
                          <CheckCircle color="#10B981" size={16} />
                        ) : (
                          <AlertTriangle color="#F59E0B" size={16} />
                        )}
                        <Text className="text-gray-700 ml-2">Documents uploaded</Text>
                      </View>
                      <View className="flex-row items-center">
                        {selectedEvent.strategy ? (
                          <CheckCircle color="#10B981" size={16} />
                        ) : (
                          <AlertTriangle color="#F59E0B" size={16} />
                        )}
                        <Text className="text-gray-700 ml-2">Race strategy planned</Text>
                      </View>
                      <View className="flex-row items-center">
                        {selectedEvent.crewConfirmed === selectedEvent.crewTotal ? (
                          <CheckCircle color="#10B981" size={16} />
                        ) : (
                          <AlertTriangle color="#F59E0B" size={16} />
                        )}
                        <Text className="text-gray-700 ml-2">
                          Crew confirmed ({selectedEvent.crewConfirmed}/{selectedEvent.crewTotal})
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Quick Actions */}
            <View className="flex-row flex-wrap gap-2 mb-6">
            <TouchableOpacity
              className="bg-blue-600 flex-1 py-3 rounded-lg items-center"
              onPress={() => {
                // Navigate to full race details screen
                // @ts-ignore - Router navigation if available
                if (global.router && selectedEvent?.id) {
                  // @ts-ignore
                  global.router.push(`/(tabs)/race/scrollable/${selectedEvent.id}`);
                }
              }}
            >
              <Text className="text-white font-bold">Open Details</Text>
            </TouchableOpacity>
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-white font-bold">View Strategy</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-blue-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-white font-bold">Weather</Text>
              </TouchableOpacity>
              <TouchableOpacity className="border border-blue-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-blue-600 font-bold">Get Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity className="border border-blue-600 flex-1 py-3 rounded-lg items-center">
                <Text className="text-blue-600 font-bold">Share</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Loading state
  if (racesLoading || venuesLoading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-gray-600 mt-4">Loading calendar data...</Text>
      </View>
    );
  }

  // Error state
  if (racesError) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-6">
        <AlertTriangle color="#EF4444" size={48} />
        <Text className="text-gray-800 text-lg font-semibold mt-4">Failed to load races</Text>
        <Text className="text-gray-600 mt-2 text-center">{racesError}</Text>
      </View>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="bg-blue-600 pt-12 pb-4 px-4">
          <Text className="text-white text-2xl font-bold mb-2">Racing Calendar</Text>
          <Text className="text-blue-200">Your races, events & training sessions</Text>
        </View>
        <EmptyState
          variant="zero"
          icon={Calendar}
          title="No races scheduled"
          message="Start by adding your first race or regatta to track your sailing calendar"
          actionLabel="Add Race"
          onAction={() => {/* Navigate to add race */}}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-4 px-4">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-2xl font-bold mb-2">Racing Calendar</Text>
            <Text className="text-blue-200">Your races, events & training sessions</Text>
          </View>
          <TouchableOpacity
            className="bg-blue-700 px-4 py-2 rounded-lg flex-row items-center"
            onPress={() => {
              // @ts-ignore - Router navigation
              if (global.router) {
                // @ts-ignore
                global.router.push('/calendar/circuit-planner');
              }
            }}
          >
            <Plane color="white" size={16} />
            <Text className="text-white font-bold ml-2">Plan Circuit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Controls */}
      <View className="bg-white px-4 py-3 shadow-sm">
        {/* View Switcher */}
        <View className="flex-row mb-3">
      {[
            { key: 'month', label: 'Month', icon: Calendar },
            { key: 'list', label: 'List', icon: FileText },
            { key: 'map', label: 'Map', icon: MapIcon },
          ].map((mode) => (
            <TouchableOpacity
              key={mode.key}
              className={`flex-row items-center px-3 py-2 rounded-lg mr-2 ${
                viewMode === mode.key ? 'bg-blue-600' : 'bg-gray-100'
              }`}
              onPress={() => setViewMode(mode.key as any)}
            >
              <mode.icon color={viewMode === mode.key ? 'white' : '#6B7280'} size={16} />
              <Text className={`font-medium ml-1 ${viewMode === mode.key ? 'text-white' : 'text-gray-700'}`}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-lg px-2 py-2 mb-2">
          <Search color="#6B7280" size={16} />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Search races or venues..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {/* Filter Buttons */}
        <View className="flex-row mb-2">
          {[
            { key: 'all', label: 'All', color: 'gray' },
            { key: 'registered', label: 'My Races', color: 'blue' },
            { key: 'available', label: 'Open', color: 'green' },
            { key: 'travel', label: 'Travel', color: 'orange' },
          ].map((filterType) => (
            <TouchableOpacity
              key={filterType.key}
              className={`px-3 py-1 rounded-full mr-2 ${
                filter === filterType.key ? `bg-${filterType.color}-100` : 'bg-gray-100'
              }`}
              onPress={() => setFilter(filterType.key)}
            >
              <Text className={`text-xs ${
                filter === filterType.key ? `text-${filterType.color}-800` : 'text-gray-700'
              }`}>
                {filterType.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Venue Filter */}
        {savedVenues.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <TouchableOpacity
              className={`px-3 py-1 rounded-full mr-2 ${selectedVenueId === 'all' ? 'bg-blue-100' : 'bg-gray-100'}`}
              onPress={() => setSelectedVenueId('all')}
            >
              <Text className={`${selectedVenueId === 'all' ? 'text-blue-800' : 'text-gray-700'} text-xs`}>All Venues</Text>
            </TouchableOpacity>
            {savedVenues.map(v => (
              <TouchableOpacity
                key={v.id}
                className={`px-3 py-1 rounded-full mr-2 ${selectedVenueId === v.id ? 'bg-blue-100' : 'bg-gray-100'}`}
                onPress={() => setSelectedVenueId(v.id)}
              >
                <Text className={`${selectedVenueId === v.id ? 'text-blue-800' : 'text-gray-700'} text-xs`}>{v.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Date Range Presets */}
        <View className="flex-row">
          {[
            { key: 'all', label: 'All Dates' },
            { key: 'month', label: 'This Month' },
            { key: 'next30', label: 'Next 30d' },
          ].map(p => (
            <TouchableOpacity
              key={p.key}
              className={`px-3 py-1 rounded-full mr-2 ${datePreset === (p.key as any) ? 'bg-blue-100' : 'bg-gray-100'}`}
              onPress={() => setDatePreset(p.key as any)}
            >
              <Text className={`${datePreset === (p.key as any) ? 'text-blue-800' : 'text-gray-700'} text-xs`}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Month View */}
      {viewMode === 'month' && (
        <ScrollView className="flex-1 px-4 py-4">
          <View className="flex-row justify-between items-center mb-4">
            <TouchableOpacity onPress={prevMonth}>
              <ChevronLeft color="#007AFF" size={24} />
            </TouchableOpacity>
            <Text className="text-lg font-bold">{formatMonthYear(currentDate)}</Text>
            <TouchableOpacity onPress={nextMonth}>
              <ChevronRight color="#007AFF" size={24} />
            </TouchableOpacity>
          </View>

          <View className="flex-row mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <View key={day} className="flex-1 items-center">
                <Text className="font-bold text-gray-600">{day}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {renderCalendarGrid()}
          </View>

          {/* Legend */}
          <View className="mt-6 bg-white rounded-xl p-4">
            <Text className="font-bold mb-3">Event Types</Text>
            <View className="flex-row flex-wrap">
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                <Text className="text-gray-700 text-sm">My Races</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                <Text className="text-gray-700 text-sm">Open Regattas</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-orange-500 mr-2" />
                <Text className="text-gray-700 text-sm">Travel Events</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
                <Text className="text-gray-700 text-sm">Training</Text>
              </View>
              <View className="flex-row items-center mr-4 mb-2">
                <View className="w-3 h-3 rounded-full bg-gray-500 mr-2" />
                <Text className="text-gray-700 text-sm">Social</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* List View */}
      {viewMode === 'list' && renderListView()}

      {/* Map View */}
      {viewMode === 'map' && (
        <CalendarMapView
          events={filteredEvents}
          venues={venuesForMap}
          onEventPress={(event) => {
            setSelectedEvent(event);
            setShowEventModal(true);
          }}
          onVenuePress={(_venue) => {
            // Handle venue press
          }}
        />
      )}

      {/* Event Detail Modal */}
      {renderEventModal()}
    </View>
  );
};

export default CalendarScreen;
