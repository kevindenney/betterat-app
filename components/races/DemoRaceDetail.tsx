import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { Card } from '@/components/ui/card';
import { Button, ButtonText } from '@/components/ui/button';
import { MockRace } from '@/constants/mockData';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlanModeContent } from './plan/PlanModeContent';
import { RaceConditionsCard } from '@/components/race-detail';

interface DemoRaceDetailProps {
  race: MockRace;
  onAddRace?: () => void;
  onLogisticsSectionLayout?: (y: number) => void;
  onRegulatorySectionLayout?: (y: number) => void;
}

interface RigPreset {
  id: string;
  label: string;
  windRange: string;
  uppers: string;
  lowers: string;
  runners: string;
  ram: string;
  notes: string;
}

interface RegulatoryDigestData {
  seriesName: string;
  venueArea: string;
  cleanRegatta: boolean;
  signOnWindow: string;
  entryNotes: string[];
  courseSelection: string;
  safetyNotes: string[];
  reference: string;
}

interface RegulatoryAcknowledgements {
  cleanRegatta: boolean;
  signOn: boolean;
  safetyBriefing: boolean;
}

interface CourseOutlineGroup {
  group: string;
  description: string;
  courses: {
    name: string;
    sequence: string;
  }[];
}

function DemoRegulatoryDigestCard({ digest, acknowledgements, onToggle: _onToggle, onAddRace }: {
  digest: RegulatoryDigestData;
  acknowledgements: RegulatoryAcknowledgements;
  onToggle: (key: keyof RegulatoryAcknowledgements) => void;
  onAddRace?: () => void;
}) {
  const ackItems: { key: keyof RegulatoryAcknowledgements; label: string; description: string }[] = [
    {
      key: 'cleanRegatta',
      label: 'Clean Regatta commitments noted',
      description: digest.cleanRegatta ? 'Event flagged as Sailors for the Sea Clean Regatta.' : 'Not designated Clean Regatta.',
    },
    {
      key: 'signOn',
      label: 'Sign-on window understood',
      description: digest.signOnWindow,
    },
    {
      key: 'safetyBriefing',
      label: 'Safety briefing complete',
      description: 'Required video briefing and quiz submitted in SailSys.',
    },
  ];

  return (
    <View className="bg-white border border-purple-200 rounded-2xl p-4 mb-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-base font-semibold text-purple-900">Notice of Race Digest</Text>
          <Text className="text-xs text-purple-600 mt-1">
            {digest.seriesName} • {digest.venueArea}
          </Text>
        </View>
        <View className="bg-purple-100 px-2 py-0.5 rounded-full">
          <Text className="text-[10px] font-semibold text-purple-700">DEMO</Text>
        </View>
      </View>

      <View className="mt-3">
        <Text className="text-sm font-semibold text-slate-900">Entry &amp; Compliance</Text>
        {digest.entryNotes.map((note, index) => (
          <View key={`${note}-${index}`} className="flex-row items-start gap-2 mt-2">
            <View className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1" />
            <Text className="text-xs text-slate-700 flex-1">{note}</Text>
          </View>
        ))}
      </View>

      <View className="mt-3">
        <Text className="text-sm font-semibold text-slate-900">Acknowledgements</Text>
        {ackItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => {
              showAlertWithButtons(
                'Create Your Race',
                'You\'re exploring demo mode! Create your first race to acknowledge regulatory requirements.',
                [
                  { text: 'Create Race', onPress: onAddRace },
                  { text: 'Keep Exploring', style: 'cancel' }
                ]
              );
            }}
            className="flex-row items-start gap-3 mt-3"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledgements[item.key] }}
          >
            <MaterialCommunityIcons
              name={acknowledgements[item.key] ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={20}
              color={acknowledgements[item.key] ? '#007AFF' : '#CBD5F5'}
            />
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-800">{item.label}</Text>
              <Text className="text-[11px] text-slate-500 mt-1">{item.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mt-4">
        <Text className="text-sm font-semibold text-slate-900">Course Selection</Text>
        <Text className="text-xs text-slate-600 mt-1">{digest.courseSelection}</Text>
      </View>

      <View className="mt-4">
        <Text className="text-sm font-semibold text-slate-900">Safety Notes</Text>
        {digest.safetyNotes.map((note, index) => (
          <View key={`${note}-${index}`} className="flex-row items-start gap-2 mt-2">
            <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#F97316" />
            <Text className="text-xs text-slate-700 flex-1">{note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CourseOutlineCard({ groups }: { groups: CourseOutlineGroup[] }) {
  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
      <Text className="text-base font-semibold text-slate-900">Course Outlines</Text>
      {groups.map((group) => (
        <View key={group.group} className="mt-4">
          <Text className="text-sm font-semibold text-slate-800">{group.group}</Text>
          <Text className="text-xs text-slate-500 mt-1">{group.description}</Text>
          <View className="mt-2">
            {group.courses.map((course) => (
              <View key={course.name} className="flex-row items-start gap-3 mt-1">
                <Text className="text-[11px] font-semibold text-slate-700 w-20">{course.name}</Text>
                <Text className="flex-1 text-[11px] text-slate-600">{course.sequence}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function DemoRaceDetail({ race, onAddRace, onLogisticsSectionLayout, onRegulatorySectionLayout }: DemoRaceDetailProps) {
  const [selectedRigBand, setSelectedRigBand] = useState<string>('medium');
  const [demoNotes, setDemoNotes] = useState<string>('');
  // Pre-check some acknowledgements for demo to show what it looks like when items are acknowledged
  const [regattaAcknowledgements, _setRegattaAcknowledgements] = useState<RegulatoryAcknowledgements>({
    cleanRegatta: true, // Pre-checked to show acknowledged state
    signOn: true, // Pre-checked to show acknowledged state
    safetyBriefing: false, // Leave one unchecked to show "2/3 ack'd"
  });

  // Demo rig presets based on wind conditions
  const rigPresets: RigPreset[] = [
    {
      id: 'light',
      label: 'Light Air',
      windRange: '< 8 kn',
      uppers: '12–13 Loos',
      lowers: 'Slack (0–1 turn off)',
      runners: 'Ease for visible sag',
      ram: '+2 cm forward',
      notes: 'Power on: ease lowers and runners to maintain depth and acceleration.',
    },
    {
      id: 'medium',
      label: 'Today',
      windRange: `${race.wind.speedMin}–${race.wind.speedMax} kn`,
      uppers: '14–16 Loos',
      lowers: 'Mast straight athwartships',
      runners: '≈30 Loos – stay just taut',
      ram: 'Neutral to +1 cm',
      notes: `Baseline ${race.venue} tune; traveller slightly weather, maintain twist in chop.`,
    },
    {
      id: 'fresh',
      label: 'Fresh Breeze',
      windRange: '15–20 kn',
      uppers: '17–18 Loos',
      lowers: '+½ turn',
      runners: '35–40 Loos',
      ram: '+3 cm forward',
      notes: 'Flatten sails, move lead aft ½ hole, ease traveller down in gusts.',
    },
  ];

  const handleDemoInteraction = () => {
    showAlertWithButtons(
      'Create Your Race',
      'You\'re exploring demo mode! Create your first race to:\n\n- Save custom rig settings\n- Track tuning notes\n- Get tuning recommendations\n- Sync with your crew',
      [
        { text: 'Create Race', onPress: onAddRace },
        { text: 'Keep Exploring', style: 'cancel' }
      ]
    );
  };

  const handleToggleAcknowledgement = (_key: keyof RegulatoryAcknowledgements) => {
    handleDemoInteraction();
  };

  // Mock regulatory digest data
  const regulatoryDigest = useMemo<RegulatoryDigestData>(() => ({
    seriesName: race.race_type === 'distance' ? 'Demo Distance Series 2025' : 'Demo Series • Autumn Series 2025',
    venueArea: race.venue,
    cleanRegatta: true,
    signOnWindow: 'Sign-on via SailSys ≥10 minutes before warning signal',
    entryNotes: [
      'Single season entry through SailSys for Dragon class',
      'Complete mandatory safety briefing video and quiz',
      'Acknowledge boat safety responsibilities and Club Bye-Laws',
    ],
    courseSelection: race.race_type === 'distance'
      ? 'Route waypoints displayed on Race Committee board. Confirm final route at skipper briefing.'
      : 'Courses selected from RHKYC Attachment B (Geometric Courses). Race Committee will display course on board.',
    safetyNotes: [
      'Keep clear of commercial traffic; breaches may result in DSQ without hearing',
      'Race Committee may bar future entry for serious safety violations',
    ],
    reference: 'RHKYC Dragon Class NoR 2025–2026',
  }), [race]);

  // Mock course outline groups
  const courseOutlineGroups = useMemo<CourseOutlineGroup[]>(() => {
    if (race.race_type === 'distance') {
      return []; // Distance races don't use course outlines
    }
    return [
      {
        group: 'Group 1',
        description: 'All marks rounded to port',
        courses: [
          { name: 'Course 1', sequence: 'Start – A – C – A – C – Finish at A' },
          { name: 'Course 2', sequence: 'Start – A – C – A – B – C – Finish at A' },
          { name: 'Course 3', sequence: 'Start – A – C – A – C – A – C – Finish at A' },
        ],
      },
      {
        group: 'Group 2',
        description: 'Gate C1/C2 (if replaced by single mark, round to port)',
        courses: [
          { name: 'Course 12', sequence: 'Start – A – Finish' },
          { name: 'Course 13', sequence: 'Start – A – C1/C2 – A – Finish' },
          { name: 'Course 14', sequence: 'Start – A – C1/C2 – A – C1/C2 – A – Finish' },
        ],
      },
    ];
  }, [race]);

  // Mock venue coordinates for demo races
  const venueCoordinates = useMemo(() => {
    // Default HK coordinates
    return { lat: 22.3193, lng: 114.1694 };
  }, []);

  // Determine race status (always future for demo races)
  // Check if race date is in the future to determine status
  const raceDate = new Date(race.date);
  const now = new Date();
  const raceStatus: 'past' | 'next' | 'future' = raceDate > now ? 'future' : 'past';
  const _isRaceFuture = raceDate > now;

  return (
    <View className="gap-4 mt-2">
      <PlanModeContent
        raceData={race}
        raceId={race.id}
        raceStatus={raceStatus}
        sections={{
          conditions: (
            <>
              {/* Conditions Card with mock data */}
              <RaceConditionsCard
                raceId={race.id}
                raceTime={race.date}
                venueCoordinates={venueCoordinates}
                venue={{
                  id: `demo-venue-${race.venueId || 'default'}`,
                  name: race.venue,
                  coordinates: {
                    latitude: venueCoordinates.lat,
                    longitude: venueCoordinates.lng,
                  },
                  region: 'asia_pacific',
                  country: 'HK',
                }}
                warningSignalTime={race.critical_details?.warning_signal || race.startTime}
                expectedDurationMinutes={
                  race.race_type === 'distance'
                    ? race.total_distance_nm
                      ? Math.round(race.total_distance_nm / 5 * 60) // ~5 knots avg speed
                      : 360 // Default 6 hours for distance races
                    : 90 // Default 90 min for fleet races
                }
                savedWind={{
                  speed: (race.wind.speedMin + race.wind.speedMax) / 2,
                  speedMin: race.wind.speedMin,
                  speedMax: race.wind.speedMax,
                  direction: race.wind.direction,
                  directionCardinal: race.wind.direction,
                }}
                savedTide={{
                  state: race.tide.state,
                  height: race.tide.height,
                  phase: race.tide.state,
                }}
                savedWeatherFetchedAt={new Date().toISOString()}
                raceStatus={raceStatus}
              />
            </>
          ),
          courseAndStrategy: (
            <>
              {race.race_type === 'distance' ? (
                <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
                  <Text className="text-base font-semibold text-slate-900 mb-2">Distance Race Route</Text>
                  <Text className="text-sm text-slate-700 mb-3">
                    {race.name} • {race.total_distance_nm} nm
                  </Text>
                  <Text className="text-xs text-slate-600 mb-3">
                    Route waypoints and strategy planning will be available when you create your race.
                  </Text>
                  <View className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <Text className="text-xs font-semibold text-blue-900 mb-1">Demo Route Info</Text>
                    <Text className="text-xs text-blue-800">
                      Long distance race around Lantau Island. Monitor weather patterns and plan for changing conditions.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
                  <Text className="text-base font-semibold text-slate-900 mb-2">Fleet Race Course</Text>
                  <Text className="text-sm text-slate-700 mb-3">
                    Tactical race map and course selection will be available when you create your race.
                  </Text>
                  <View className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <Text className="text-xs font-semibold text-green-900 mb-1">Demo Strategy</Text>
                    <Text className="text-xs text-green-800">{race.strategy}</Text>
                  </View>
                </View>
              )}
              <Card className="p-4 gap-3 border border-dashed border-blue-200 bg-blue-50">
                <Text className="text-xs text-slate-600">
                  Create your race to unlock full course mapping, AI strategy analysis, and tactical overlays.
                </Text>
              </Card>
            </>
          ),
          boatSetup: (
            <>
              <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-semibold text-slate-900">Rig &amp; Sail Planner</Text>
                  <TouchableOpacity
                    onPress={handleDemoInteraction}
                    accessibilityRole="button"
                    className="flex-row items-center"
                  >
                    <MaterialCommunityIcons name="chat-processing-outline" size={16} color="#007AFF" />
                    <Text className="text-xs font-semibold text-blue-600 ml-1">Review chat</Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap gap-2 mb-3">
                  {rigPresets.map((preset) => {
                    const isActive = preset.id === selectedRigBand;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        onPress={() => {
                          setSelectedRigBand(preset.id);
                          handleDemoInteraction();
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        className={`px-3 py-2 rounded-full border ${isActive ? 'bg-blue-600 border-blue-600' : 'bg-blue-50 border-blue-200'}`}
                      >
                        <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-blue-700'}`}>
                          {preset.label} • {preset.windRange}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View className="bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-3">
                  {(() => {
                    const activePreset = rigPresets.find((p) => p.id === selectedRigBand) ?? rigPresets[1];
                    return (
                      <>
                        <View className="flex-row items-start justify-between mt-1">
                          <Text className="text-xs font-semibold text-blue-900">Uppers</Text>
                          <Text className="text-xs text-blue-800 text-right ml-3 flex-1">{activePreset.uppers}</Text>
                        </View>
                        <View className="flex-row items-start justify-between mt-1">
                          <Text className="text-xs font-semibold text-blue-900">Lowers</Text>
                          <Text className="text-xs text-blue-800 text-right ml-3 flex-1">{activePreset.lowers}</Text>
                        </View>
                        <View className="flex-row items-start justify-between mt-1">
                          <Text className="text-xs font-semibold text-blue-900">Runners</Text>
                          <Text className="text-xs text-blue-800 text-right ml-3 flex-1">{activePreset.runners}</Text>
                        </View>
                        <View className="flex-row items-start justify-between mt-1">
                          <Text className="text-xs font-semibold text-blue-900">Mast Ram</Text>
                          <Text className="text-xs text-blue-800 text-right ml-3 flex-1">{activePreset.ram}</Text>
                        </View>
                        <Text className="text-[11px] text-blue-900 mt-2">{activePreset.notes}</Text>
                      </>
                    );
                  })()}
                </View>

                <TextInput
                  value={demoNotes}
                  onChangeText={setDemoNotes}
                  onFocus={handleDemoInteraction}
                  placeholder="Notes or adjustments (e.g., traveller +1 cm, jib lead aft ½ hole)"
                  multiline
                  numberOfLines={3}
                  className="border border-slate-200 rounded-2xl px-3 py-2 text-sm text-slate-700"
                  placeholderTextColor="#94A3B8"
                />
                <Text className="text-[11px] text-slate-500 mt-2">
                  Create your race to save tuning notes and sync with your crew.
                </Text>
              </View>
            </>
          ),
          teamAndLogistics: (
            <>
              <View
                onLayout={({ nativeEvent }) => {
                  const positionY = nativeEvent.layout.y;
                  onLogisticsSectionLayout?.(positionY);
                }}
                className="bg-white border border-slate-200 rounded-2xl p-4 mb-4"
              >
                <Text className="text-base font-semibold text-slate-900 mb-2">Team &amp; Logistics</Text>
                <Text className="text-sm text-slate-700 mb-3">
                  Crew management, equipment checklists, and fleet connections will be available when you create your race.
                </Text>
                <View className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <Text className="text-xs font-semibold text-blue-900 mb-1">Demo Features</Text>
                  <Text className="text-xs text-blue-800">
                    • Manage crew assignments{'\n'}
                    • Equipment checklists{'\n'}
                    • Connect with fleet racers
                  </Text>
                </View>
              </View>
            </>
          ),
          regulatory: (
            <>
              <View
                onLayout={({ nativeEvent }) => {
                  const positionY = nativeEvent.layout.y;
                  onRegulatorySectionLayout?.(positionY);
                }}
                className="mt-6"
              >
                <DemoRegulatoryDigestCard
                  digest={regulatoryDigest}
                  acknowledgements={regattaAcknowledgements}
                  onToggle={handleToggleAcknowledgement}
                  onAddRace={onAddRace}
                />
                {courseOutlineGroups.length > 0 && (
                  <CourseOutlineCard groups={courseOutlineGroups} />
                )}
              </View>
            </>
          ),
        }}
        regulatoryAcknowledged={
          (regattaAcknowledgements.cleanRegatta ? 1 : 0) +
          (regattaAcknowledgements.signOn ? 1 : 0) +
          (regattaAcknowledgements.safetyBriefing ? 1 : 0)
        }
        regulatoryTotal={3}
      />

      <Card className="p-4 gap-3 border border-dashed border-blue-200 bg-blue-50">
        <Text className="text-base font-semibold text-blue-900">
          Want live race intelligence?
        </Text>
        <Text className="text-sm text-blue-800">
          Add your first regatta to unlock AI race prep, live weather updates, crew logistics, and more.
        </Text>
        {onAddRace && (
          <Button
            className="self-start mt-1"
            size="sm"
            onPress={onAddRace}
            accessibilityLabel="Create your first race"
          >
            <ButtonText>Add Your Race</ButtonText>
          </Button>
        )}
      </Card>
    </View>
  );
}
