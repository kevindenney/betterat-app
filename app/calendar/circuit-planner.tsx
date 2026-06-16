/**
 * Circuit Planning - Multi-Venue Racing Campaign Tool
 * Helps sailors plan international racing circuits with cost optimization,
 * logistics, and qualification tracking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  MapPin,
  Calendar,
  DollarSign,
  Ship,
  Plane,
  Hotel,
  FileText,
  Plus,
  Download,
  Share2,
  ChevronRight,
  Clock,
  TrendingUp,
  Package,
  Award,
  AlertCircle,
} from 'lucide-react-native';
import { useSavedVenues } from '@/hooks/useSavedVenues';

const { width: _width } = Dimensions.get('window');

// Types
interface CircuitEvent {
  id: string;
  venueId: string;
  venueName: string;
  country: string;
  startDate: string;
  endDate: string;
  eventName: string;
  entryFee: number;
  currency: string;
  isQualifier: boolean;
  qualificationPoints?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface TravelLeg {
  fromVenue: string;
  toVenue: string;
  distance: number; // km
  travelDays: number;
  estimatedCost: number;
  method: 'flight' | 'ferry' | 'drive';
}

interface EquipmentOption {
  type: 'ship' | 'charter' | 'buy-sell';
  description: string;
  cost: number;
  prepDays: number;
}

interface CircuitBudget {
  entryFees: number;
  travel: number;
  accommodation: number;
  equipment: number;
  meals: number;
  contingency: number;
  total: number;
}

interface Circuit {
  id: string;
  name: string;
  description: string;
  events: CircuitEvent[];
  budget: CircuitBudget;
  totalDays: number;
  totalDistance: number;
  qualificationImpact: number;
  createdAt: string;
  updatedAt: string;
}

export default function CircuitPlannerScreen() {
  const { isLoading: venuesLoading } = useSavedVenues();

  // Circuit state
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [currentCircuit, setCurrentCircuit] = useState<Circuit | null>(null);
  const [, setIsEditing] = useState(false);

  // Event modal
  const [, setShowEventModal] = useState(false);
  const [, setEditingEvent] = useState<CircuitEvent | null>(null);

  // Example circuits (would come from database)
  useEffect(() => {
    loadExampleCircuits();
  }, []);

  const loadExampleCircuits = () => {
    const examples: Circuit[] = [
      {
        id: '1',
        name: 'Asia-Pacific Spring Circuit 2025',
        description: 'Hong Kong → Japan → Australia championship circuit',
        events: [
          {
            id: 'e1',
            venueId: 'hong-kong-victoria-harbor',
            venueName: 'Royal Hong Kong Yacht Club',
            country: 'Hong Kong',
            startDate: '2025-03-15',
            endDate: '2025-03-17',
            eventName: 'RHKYC Spring Series',
            entryFee: 2500,
            currency: 'HKD',
            isQualifier: true,
            qualificationPoints: 10,
            coordinates: { lat: 22.2793, lng: 114.1628 },
          },
          {
            id: 'e2',
            venueId: 'hiroshima-bay',
            venueName: 'Hiroshima Yacht Club',
            country: 'Japan',
            startDate: '2025-04-05',
            endDate: '2025-04-07',
            eventName: 'Hiroshima Dragon Cup',
            entryFee: 35000,
            currency: 'JPY',
            isQualifier: false,
            coordinates: { lat: 34.3853, lng: 132.4553 },
          },
          {
            id: 'e3',
            venueId: 'sydney-harbor',
            venueName: 'Royal Sydney Yacht Squadron',
            country: 'Australia',
            startDate: '2025-05-10',
            endDate: '2025-05-14',
            eventName: 'Sydney Gold Cup',
            entryFee: 1200,
            currency: 'AUD',
            isQualifier: true,
            qualificationPoints: 25,
            coordinates: { lat: -33.8688, lng: 151.2093 },
          },
        ],
        budget: {
          entryFees: 3200,
          travel: 4500,
          accommodation: 2800,
          equipment: 8000,
          meals: 1500,
          contingency: 1000,
          total: 21000,
        },
        totalDays: 56,
        totalDistance: 8420,
        qualificationImpact: 35,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    setCircuits(examples);
    if (examples.length > 0) {
      setCurrentCircuit(examples[0]);
    }
  };

  // Calculate travel logistics between venues
  const calculateTravelLeg = (from: CircuitEvent, to: CircuitEvent): TravelLeg => {
    // Haversine distance formula
    const R = 6371; // Earth's radius in km
    const dLat = ((to.coordinates.lat - from.coordinates.lat) * Math.PI) / 180;
    const dLng = ((to.coordinates.lng - from.coordinates.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.coordinates.lat * Math.PI) / 180) *
        Math.cos((to.coordinates.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Determine travel method and estimate cost
    let method: 'flight' | 'ferry' | 'drive' = 'flight';
    let travelDays = 1;
    let estimatedCost = 0;

    if (distance < 200) {
      method = 'drive';
      travelDays = 1;
      estimatedCost = 100;
    } else if (distance < 1000) {
      method = 'ferry';
      travelDays = 2;
      estimatedCost = 300;
    } else {
      method = 'flight';
      travelDays = 1;
      estimatedCost = distance * 0.15; // $0.15/km flight estimate
    }

    return {
      fromVenue: from.venueName,
      toVenue: to.venueName,
      distance: Math.round(distance),
      travelDays,
      estimatedCost: Math.round(estimatedCost),
      method,
    };
  };

  // Calculate equipment options
  const calculateEquipmentOptions = (events: CircuitEvent[]): EquipmentOption[] => {
    if (events.length === 0) return [];

    const totalDistance = events.reduce((acc, event, i) => {
      if (i === 0) return 0;
      const leg = calculateTravelLeg(events[i - 1], event);
      return acc + leg.distance;
    }, 0);

    return [
      {
        type: 'ship',
        description: 'Ship boat to each venue',
        cost: totalDistance * 0.8, // $0.80/km shipping
        prepDays: 14,
      },
      {
        type: 'charter',
        description: 'Charter boats at each venue',
        cost: events.length * 2500, // $2500/event charter
        prepDays: 3,
      },
      {
        type: 'buy-sell',
        description: 'Buy boat at start, sell at end',
        cost: 5000, // Depreciation estimate
        prepDays: 7,
      },
    ];
  };

  // Render circuit card
  const renderCircuitCard = (circuit: Circuit) => (
    <TouchableOpacity
      key={circuit.id}
      className="bg-white rounded-xl shadow-sm p-4 mb-3"
      onPress={() => setCurrentCircuit(circuit)}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-bold">{circuit.name}</Text>
          <Text className="text-gray-600 text-sm mt-1">{circuit.description}</Text>
        </View>
        <View className="bg-blue-100 px-3 py-1 rounded-full">
          <Text className="text-blue-800 font-bold">{circuit.events.length} Events</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mt-3">
        <View className="flex-row items-center">
          <Calendar color="#6B7280" size={14} />
          <Text className="text-gray-600 text-sm ml-1">{circuit.totalDays} days</Text>
        </View>
        <View className="flex-row items-center">
          <Plane color="#6B7280" size={14} />
          <Text className="text-gray-600 text-sm ml-1">{circuit.totalDistance.toLocaleString()} km</Text>
        </View>
        <View className="flex-row items-center">
          <DollarSign color="#6B7280" size={14} />
          <Text className="text-gray-600 text-sm ml-1">${circuit.budget.total.toLocaleString()}</Text>
        </View>
        <View className="flex-row items-center">
          <TrendingUp color="#10B981" size={14} />
          <Text className="text-green-600 text-sm ml-1 font-bold">+{circuit.qualificationImpact}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render event timeline item
  const renderEventTimelineItem = (event: CircuitEvent, index: number, isLast: boolean) => {
    const travelLeg =
      index > 0 && currentCircuit
        ? calculateTravelLeg(currentCircuit.events[index - 1], event)
        : null;

    return (
      <View key={event.id}>
        {/* Travel leg */}
        {travelLeg && (
          <View className="flex-row items-center ml-4 mb-2">
            <View className="w-0.5 h-8 bg-blue-300" />
            <View className="ml-4 flex-1 bg-blue-50 rounded-lg p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  {travelLeg.method === 'flight' && <Plane color="#3B82F6" size={16} />}
                  {travelLeg.method === 'ferry' && <Ship color="#3B82F6" size={16} />}
                  <Text className="text-blue-800 text-sm ml-2 font-medium">
                    {travelLeg.method.charAt(0).toUpperCase() + travelLeg.method.slice(1)} travel
                  </Text>
                </View>
                <Text className="text-blue-600 text-sm font-bold">${travelLeg.estimatedCost}</Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Text className="text-blue-600 text-xs">
                  {travelLeg.distance} km • {travelLeg.travelDays} day{travelLeg.travelDays > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Event */}
        <TouchableOpacity
          className="flex-row mb-3"
          onPress={() => {
            setEditingEvent(event);
            setShowEventModal(true);
          }}
        >
          <View className="items-center mr-4">
            <View className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center">
              <Text className="text-white font-bold">{index + 1}</Text>
            </View>
            {!isLast && <View className="w-0.5 flex-1 bg-gray-300 mt-1" />}
          </View>

          <View className="flex-1 bg-white rounded-xl shadow-sm p-4">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text className="text-lg font-bold">{event.eventName}</Text>
                <Text className="text-gray-600 text-sm">{event.venueName}</Text>
              </View>
              {event.isQualifier && (
                <View className="bg-purple-100 px-2 py-1 rounded-full">
                  <Text className="text-purple-800 text-xs font-bold">Qualifier</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center mb-2">
              <Calendar color="#6B7280" size={14} />
              <Text className="text-gray-600 text-sm ml-2">
                {new Date(event.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })} - {new Date(event.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <View className="flex-row items-center mb-2">
              <MapPin color="#6B7280" size={14} />
              <Text className="text-gray-600 text-sm ml-2">{event.country}</Text>
            </View>

            <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <View className="flex-row items-center">
                <DollarSign color="#6B7280" size={14} />
                <Text className="text-gray-800 text-sm ml-1 font-bold">
                  {event.entryFee.toLocaleString()} {event.currency}
                </Text>
              </View>
              {event.qualificationPoints && (
                <View className="flex-row items-center">
                  <Award color="#8B5CF6" size={14} />
                  <Text className="text-purple-600 text-sm ml-1 font-bold">
                    +{event.qualificationPoints} pts
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render budget breakdown
  const renderBudgetBreakdown = () => {
    if (!currentCircuit) return null;

    const items = [
      { label: 'Entry Fees', amount: currentCircuit.budget.entryFees, icon: FileText },
      { label: 'Travel', amount: currentCircuit.budget.travel, icon: Plane },
      { label: 'Accommodation', amount: currentCircuit.budget.accommodation, icon: Hotel },
      { label: 'Equipment', amount: currentCircuit.budget.equipment, icon: Package },
      { label: 'Meals', amount: currentCircuit.budget.meals, icon: DollarSign },
      { label: 'Contingency', amount: currentCircuit.budget.contingency, icon: AlertCircle },
    ];

    return (
      <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <Text className="text-lg font-bold mb-4">Budget Breakdown</Text>

        {items.map((item, index) => {
          const percentage = (item.amount / currentCircuit.budget.total) * 100;
          const Icon = item.icon;

          return (
            <View key={index} className="mb-3">
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center">
                  <Icon color="#6B7280" size={16} />
                  <Text className="text-gray-700 ml-2">{item.label}</Text>
                </View>
                <Text className="text-gray-900 font-bold">${item.amount.toLocaleString()}</Text>
              </View>
              <View className="bg-gray-200 h-2 rounded-full">
                <View
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </View>
            </View>
          );
        })}

        <View className="pt-3 mt-3 border-t border-gray-200">
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-bold">Total Budget</Text>
            <Text className="text-2xl font-bold text-blue-600">
              ${currentCircuit.budget.total.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Render equipment options
  const renderEquipmentOptions = () => {
    if (!currentCircuit) return null;

    const options = calculateEquipmentOptions(currentCircuit.events);

    return (
      <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <Text className="text-lg font-bold mb-4">Equipment Strategy</Text>

        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200"
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text className="text-gray-900 font-bold mb-1">
                  {option.type === 'ship' && '🚢 Ship Equipment'}
                  {option.type === 'charter' && '🎯 Charter Locally'}
                  {option.type === 'buy-sell' && '💰 Buy & Sell'}
                </Text>
                <Text className="text-gray-600 text-sm">{option.description}</Text>
              </View>
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-blue-800 font-bold">${Math.round(option.cost).toLocaleString()}</Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <Clock color="#6B7280" size={14} />
              <Text className="text-gray-600 text-sm ml-2">
                {option.prepDays} days prep time needed
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render qualification impact
  const renderQualificationImpact = () => {
    if (!currentCircuit) return null;

    return (
      <View className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-sm p-4 mb-4">
        <View className="flex-row items-center mb-3">
          <Award color="#8B5CF6" size={24} />
          <Text className="text-lg font-bold ml-2">Championship Qualification</Text>
        </View>

        <View className="bg-white rounded-lg p-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-700">Circuit Impact</Text>
            <Text className="text-2xl font-bold text-purple-600">
              +{currentCircuit.qualificationImpact}%
            </Text>
          </View>
          <View className="bg-gray-200 h-3 rounded-full">
            <View
              className="bg-purple-600 h-3 rounded-full"
              style={{ width: `${Math.min(currentCircuit.qualificationImpact, 100)}%` }}
            />
          </View>

          <View className="mt-3 pt-3 border-t border-gray-100">
            <Text className="text-gray-600 text-sm">
              Completing this circuit increases your World Championship qualification chances by{' '}
              <Text className="font-bold text-purple-600">
                {currentCircuit.qualificationImpact}%
              </Text>
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (venuesLoading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-gray-600 mt-4">Loading venues...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-4 px-4">
        <Text className="text-white text-2xl font-bold mb-2">Circuit Planner</Text>
        <Text className="text-blue-200">Plan multi-venue racing campaigns</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Circuit List */}
        {!currentCircuit && (
          <View className="px-4 py-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Your Circuits</Text>
              <TouchableOpacity
                className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center"
                onPress={() => setIsEditing(true)}
              >
                <Plus color="white" size={20} />
                <Text className="text-white font-bold ml-2">New Circuit</Text>
              </TouchableOpacity>
            </View>

            {circuits.map(renderCircuitCard)}

            {circuits.length === 0 && (
              <View className="bg-white rounded-xl p-8 items-center">
                <MapPin color="#9CA3AF" size={48} />
                <Text className="text-gray-800 text-lg font-semibold mt-4">No circuits yet</Text>
                <Text className="text-gray-600 mt-2 text-center">
                  Create your first racing circuit to plan multi-venue campaigns
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Circuit Detail View */}
        {currentCircuit && (
          <View className="px-4 py-4">
            {/* Back button */}
            <TouchableOpacity
              className="flex-row items-center mb-4"
              onPress={() => setCurrentCircuit(null)}
            >
              <ChevronRight color="#007AFF" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
              <Text className="text-blue-600 font-medium ml-1">Back to circuits</Text>
            </TouchableOpacity>

            {/* Circuit header */}
            <View className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <Text className="text-2xl font-bold mb-2">{currentCircuit.name}</Text>
              <Text className="text-gray-600 mb-4">{currentCircuit.description}</Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="bg-blue-50 px-3 py-2 rounded-lg flex-row items-center">
                  <Calendar color="#007AFF" size={16} />
                  <Text className="text-blue-800 ml-2 font-medium">{currentCircuit.totalDays} days</Text>
                </View>
                <View className="bg-orange-50 px-3 py-2 rounded-lg flex-row items-center">
                  <Plane color="#F59E0B" size={16} />
                  <Text className="text-orange-800 ml-2 font-medium">
                    {currentCircuit.totalDistance.toLocaleString()} km
                  </Text>
                </View>
                <View className="bg-green-50 px-3 py-2 rounded-lg flex-row items-center">
                  <DollarSign color="#10B981" size={16} />
                  <Text className="text-green-800 ml-2 font-medium">
                    ${currentCircuit.budget.total.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Event Timeline */}
            <View className="mb-4">
              <Text className="text-xl font-bold mb-4">Event Timeline</Text>
              {currentCircuit.events.map((event, index) =>
                renderEventTimelineItem(event, index, index === currentCircuit.events.length - 1)
              )}
            </View>

            {/* Budget Breakdown */}
            {renderBudgetBreakdown()}

            {/* Equipment Options */}
            {renderEquipmentOptions()}

            {/* Qualification Impact */}
            {renderQualificationImpact()}

            {/* Actions */}
            <View className="flex-row gap-3 mb-6">
              <TouchableOpacity className="flex-1 bg-blue-600 py-4 rounded-lg items-center">
                <View className="flex-row items-center">
                  <Download color="white" size={20} />
                  <Text className="text-white font-bold ml-2">Export PDF</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 border border-blue-600 py-4 rounded-lg items-center">
                <View className="flex-row items-center">
                  <Share2 color="#007AFF" size={20} />
                  <Text className="text-blue-600 font-bold ml-2">Share</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
