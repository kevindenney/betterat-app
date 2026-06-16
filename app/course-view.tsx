import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import {
  Edit,
  Trash2,
  Plus,
  Navigation,
  Wind,
  Waves,
  Thermometer,
  Droplets,
  Mountain,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Info,
  Settings
} from 'lucide-react-native';

const CourseViewScreen = () => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [selectedMark, setSelectedMark] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showTidalData, setShowTidalData] = useState(true);
  const [showDepthContours, setShowDepthContours] = useState(true);
  const [showWindData, setShowWindData] = useState(true);
  const [animationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const panRef = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const _scaleRef = useRef(new Animated.Value(1)).current;
  
  // Mock data for course visualization
  const courseDetails = {
    name: "RHKYC Spring Series Course",
    venue: "Victoria Harbour",
    date: "May 15, 2023",
    startTime: "14:00",
    courseType: "Windward-Leeward",
    length: "1.2 nautical miles"
  };

  const marks = [
    { id: '1', name: 'Start Line', type: 'start', position: { x: 30, y: 70 }, description: "Committee boat at port end" },
    { id: '2', name: 'Windward Mark', type: 'mark', position: { x: 50, y: 30 }, description: "Red buoy - 1.0nm from start" },
    { id: '3', name: 'Leeward Mark', type: 'mark', position: { x: 50, y: 70 }, description: "Green buoy - downwind gate" },
    { id: '4', name: 'Finish Line', type: 'finish', position: { x: 70, y: 70 }, description: "Crossing finish line within 3 boat lengths" }
  ];

  const tidalData = {
    direction: "SW",
    speed: "0.8kt",
    height: "1.2m",
    cycle: "Flood"
  };

  const windData = {
    speed: "12-15kt",
    direction: "NE",
    gusts: "18kt",
    temp: "22°C"
  };

  const landmarks = [
    { name: "Hong Kong Island", position: { x: 20, y: 20 } },
    { name: "Kowloon Peninsula", position: { x: 80, y: 80 } }
  ];

  const tacticalNotes = [
    "Start at committee boat end for better fetch to windward mark",
    "Favor right side of course in NE wind conditions",
    "Tide sets in from SW - watch for lift on leeward return"
  ];

  const handleMarkSelect = (markId: string) => {
    setSelectedMark(markId === selectedMark ? null : markId);
  };

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 0.2, 0.5));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(0);
    panRef.setValue({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((rotation + 45) % 360);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const render3DControls = () => (
    <View className="flex-row justify-between items-center mb-3">
      <View className="flex-row bg-gray-100 rounded-lg p-1">
        <TouchableOpacity 
          className={`px-3 py-1 rounded-md ${viewMode === '2d' ? 'bg-white shadow' : ''}`}
          onPress={() => setViewMode('2d')}
        >
          <Text className={viewMode === '2d' ? 'text-blue-600 font-bold' : 'text-gray-600'}>2D</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`px-3 py-1 rounded-md ${viewMode === '3d' ? 'bg-white shadow' : ''}`}
          onPress={() => setViewMode('3d')}
        >
          <Text className={viewMode === '3d' ? 'text-blue-600 font-bold' : 'text-gray-600'}>3D</Text>
        </TouchableOpacity>
      </View>
      
      <View className="flex-row">
        <TouchableOpacity className="p-2 bg-gray-100 rounded-full mx-1" onPress={handleZoomIn}>
          <ZoomIn color="#007AFF" size={20} />
        </TouchableOpacity>
        <TouchableOpacity className="p-2 bg-gray-100 rounded-full mx-1" onPress={handleZoomOut}>
          <ZoomOut color="#007AFF" size={20} />
        </TouchableOpacity>
        <TouchableOpacity className="p-2 bg-gray-100 rounded-full mx-1" onPress={handleRotate}>
          <RotateCw color="#007AFF" size={20} />
        </TouchableOpacity>
        <TouchableOpacity className="p-2 bg-gray-100 rounded-full mx-1" onPress={handleResetView}>
          <RotateCcw color="#007AFF" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCourseDiagram = () => (
    <View className="bg-white rounded-xl shadow-md p-4 mb-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-bold">Course Visualization</Text>
        <TouchableOpacity 
          className="flex-row items-center bg-blue-100 px-3 py-1 rounded-full"
          onPress={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 color="#007AFF" size={16} /> : <Maximize2 color="#007AFF" size={16} />}
          <Text className="text-blue-600 ml-1 font-medium">
            {isFullscreen ? 'Minimize' : 'Fullscreen'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {render3DControls()}
      
      {/* Course Diagram Container */}
      <View className="bg-blue-50 rounded-xl p-4">
        <View 
          className={`relative border-2 border-blue-300 ${isFullscreen ? 'h-96' : 'h-64'} bg-blue-100 rounded-lg`}
        >
          {/* Water background */}
          <View className="absolute inset-0 bg-blue-200 opacity-30" />
          
          {/* Depth contours */}
          {showDepthContours && (
            <>
              <View className="absolute top-4 left-4 w-32 h-0.5 bg-blue-400 opacity-50" />
              <View className="absolute top-8 left-8 w-24 h-0.5 bg-blue-500 opacity-50" />
              <View className="absolute top-12 left-12 w-16 h-0.5 bg-blue-600 opacity-50" />
            </>
          )}
          
          {/* Landmarks */}
          {landmarks.map((landmark, index) => (
            <View 
              key={index}
              className="absolute w-6 h-6 rounded-full bg-green-500 items-center justify-center"
              style={{
                left: `${landmark.position.x}%`,
                top: `${landmark.position.y}%`,
                transform: [{ translateX: -12 }, { translateY: -12 }]
              }}
            >
              <Mountain color="white" size={16} />
            </View>
          ))}
          
          {/* Course marks */}
          {marks.map((mark) => (
            <TouchableOpacity
              key={mark.id}
              className={`absolute w-8 h-8 rounded-full items-center justify-center border-2 ${
                selectedMark === mark.id 
                  ? 'border-blue-600 bg-blue-100' 
                  : 'border-blue-400 bg-white'
              }`}
              style={{
                left: `${mark.position.x}%`,
                top: `${mark.position.y}%`,
                transform: [{ translateX: -16 }, { translateY: -16 }]
              }}
              onPress={() => handleMarkSelect(mark.id)}
            >
              <Text className="font-bold text-blue-800">
                {mark.type === 'start' ? 'S' : mark.type === 'finish' ? 'F' : mark.id}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Course lines */}
          <View className="absolute h-0.5 bg-blue-600" 
            style={{
              left: '30%',
              top: '70%',
              width: '20%',
              transform: [{ translateY: -1 }]
            }} 
          />
          <View className="absolute w-0.5 bg-blue-600" 
            style={{
              left: '50%',
              top: '30%',
              height: '40%',
              transform: [{ translateX: -1 }]
            }} 
          />
          <View className="absolute h-0.5 bg-blue-600" 
            style={{
              left: '50%',
              top: '70%',
              width: '20%',
              transform: [{ translateY: -1 }]
            }} 
          />
          
          {/* Wind direction indicator */}
          <View className="absolute top-2 right-2 flex-row items-center bg-white px-2 py-1 rounded-full shadow">
            <Navigation color="#007AFF" size={20} className="transform rotate-45" />
            <Text className="text-blue-600 ml-1 font-bold">NE</Text>
          </View>
          
          {/* Tidal indicator */}
          {showTidalData && (
            <View className="absolute bottom-2 left-2 flex-row items-center bg-white px-2 py-1 rounded-full shadow">
              <Waves color="#3B82F6" size={20} />
              <Text className="text-blue-600 ml-1 font-bold">SW 0.8kt</Text>
            </View>
          )}
        </View>
        
        {/* Mark details */}
        {selectedMark && (
          <View className="mt-4 p-3 bg-white rounded-lg border border-blue-200 shadow">
            <Text className="font-bold text-blue-800">
              {marks.find(m => m.id === selectedMark)?.name}
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              {marks.find(m => m.id === selectedMark)?.description}
            </Text>
          </View>
        )}
      </View>
      
      {/* Data Layers Toggle */}
      <View className="mt-4">
        <Text className="font-bold mb-2">Data Layers</Text>
        <View className="flex-row flex-wrap">
          <TouchableOpacity 
            className={`flex-row items-center px-3 py-2 rounded-full mr-2 mb-2 ${
              showTidalData ? 'bg-blue-100' : 'bg-gray-100'
            }`}
            onPress={() => setShowTidalData(!showTidalData)}
          >
            <Waves color={showTidalData ? "#007AFF" : "#6B7280"} size={16} />
            <Text className={`ml-1 ${showTidalData ? 'text-blue-600' : 'text-gray-600'}`}>Tidal</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`flex-row items-center px-3 py-2 rounded-full mr-2 mb-2 ${
              showDepthContours ? 'bg-blue-100' : 'bg-gray-100'
            }`}
            onPress={() => setShowDepthContours(!showDepthContours)}
          >
            <Droplets color={showDepthContours ? "#007AFF" : "#6B7280"} size={16} />
            <Text className={`ml-1 ${showDepthContours ? 'text-blue-600' : 'text-gray-600'}`}>Depth</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`flex-row items-center px-3 py-2 rounded-full mr-2 mb-2 ${
              showWindData ? 'bg-blue-100' : 'bg-gray-100'
            }`}
            onPress={() => setShowWindData(!showWindData)}
          >
            <Wind color={showWindData ? "#007AFF" : "#6B7280"} size={16} />
            <Text className={`ml-1 ${showWindData ? 'text-blue-600' : 'text-gray-600'}`}>Wind</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderTacticalNotes = () => (
    <View className="bg-white rounded-xl shadow-md p-4 mb-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-bold">Tactical Notes</Text>
        <TouchableOpacity className="bg-blue-100 p-1 rounded-full">
          <Plus color="#007AFF" size={20} />
        </TouchableOpacity>
      </View>
      
      {tacticalNotes.map((note, index) => (
        <View key={index} className="flex-row items-start mb-3 pb-3 border-b border-gray-100">
          <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center mt-0.5">
            <Text className="text-green-600 font-bold text-xs">{index + 1}</Text>
          </View>
          <Text className="text-gray-700 ml-3 flex-1">{note}</Text>
          <TouchableOpacity>
            <Trash2 color="#EF4444" size={16} />
          </TouchableOpacity>
        </View>
      ))}
      
      <TouchableOpacity className="flex-row items-center justify-center mt-2 py-2 bg-blue-50 rounded-lg">
        <Edit color="#007AFF" size={16} />
        <Text className="text-blue-600 ml-2 font-medium">Add Note</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWeatherSummary = () => (
    <View className="bg-white rounded-xl shadow-md p-4 mb-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-bold">Weather & Tidal Data</Text>
        <TouchableOpacity>
          <Info color="#6B7280" size={20} />
        </TouchableOpacity>
      </View>
      
      <View className="flex-row justify-between mb-3">
        <View className="items-center">
          <Wind color="#007AFF" size={24} />
          <Text className="text-gray-600 mt-1">{windData.speed}</Text>
          <Text className="text-gray-600 text-xs">{windData.direction}</Text>
        </View>
        <View className="items-center">
          <Thermometer color="#F59E0B" size={24} />
          <Text className="text-gray-600 mt-1">{windData.temp}</Text>
          <Text className="text-gray-600 text-xs">Sunny</Text>
        </View>
        <View className="items-center">
          <Waves color="#3B82F6" size={24} />
          <Text className="text-gray-600 mt-1">{tidalData.speed}</Text>
          <Text className="text-gray-600 text-xs">{tidalData.direction}</Text>
        </View>
      </View>
      
      <View className="bg-blue-50 p-3 rounded-lg">
        <Text className="text-blue-800 font-bold">Tactical Note:</Text>
        <Text className="text-blue-700">Light NE winds favor the right side of the course in the afternoon. Tide sets in from SW at 0.8kt.</Text>
      </View>
    </View>
  );

  const renderAnimationControls = () => (
    <View className="bg-white rounded-xl shadow-md p-4 mb-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-bold">Course Animation</Text>
        <TouchableOpacity onPress={togglePlay}>
          {isPlaying ? (
            <Square color="#EF4444" size={24} />
          ) : (
            <Play color="#10B981" size={24} />
          )}
        </TouchableOpacity>
      </View>
      
      <View className="flex-row items-center">
        <TouchableOpacity className="p-2 bg-gray-100 rounded-full">
          <ChevronLeft color="#007AFF" size={20} />
        </TouchableOpacity>
        
        <View className="flex-1 mx-3">
          <View className="h-2 bg-gray-200 rounded-full">
            <View 
              className="h-2 bg-blue-600 rounded-full" 
              style={{ width: `${animationProgress}%` }}
            />
          </View>
        </View>
        
        <TouchableOpacity className="p-2 bg-gray-100 rounded-full">
          <ChevronRight color="#007AFF" size={20} />
        </TouchableOpacity>
      </View>
      
      <View className="flex-row justify-between mt-2">
        <Text className="text-gray-600 text-sm">Start</Text>
        <Text className="text-gray-600 text-sm">Finish</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-4 px-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-white text-xl font-bold">Course Visualization</Text>
          <TouchableOpacity>
            <Settings color="white" size={24} />
          </TouchableOpacity>
        </View>
        <Text className="text-blue-100">{courseDetails.name}</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {renderCourseDiagram()}
        {renderAnimationControls()}
        {renderWeatherSummary()}
        {renderTacticalNotes()}
      </ScrollView>
    </View>
  );
};

export default CourseViewScreen;
