import { deriveCourseStrategy, type CourseStrategyInput } from '../courseStrategy';

// Wind FROM the south (180): windward mark to the south, "right looking
// upwind" = bearing 270 (west), "left" = 90 (east). Committee = right end,
// pin = left end.
const wind180: CourseStrategyInput = { windDirection: 180, windSpeedKn: 12 };

describe('deriveCourseStrategy — favored side from current (up-current rule)', () => {
  it('favors LEFT when the current flows toward the right (sets you right → stay up-current left)', () => {
    const s = deriveCourseStrategy({ ...wind180, currentDirection: 270, currentSpeedKn: 1 });
    expect(s.upwind.favoredSide).toBe('left');
    expect(s.downwind.favoredSide).toBe('left');
    expect(s.start.favoredEnd).toBe('pin'); // pin = left end
    expect(s.conditions.crossCurrentKn).toBeGreaterThan(0);
  });

  it('favors RIGHT when the current flows toward the left', () => {
    const s = deriveCourseStrategy({ ...wind180, currentDirection: 90, currentSpeedKn: 1 });
    expect(s.upwind.favoredSide).toBe('right');
    expect(s.start.favoredEnd).toBe('committee'); // committee = right end
    expect(s.conditions.crossCurrentKn).toBeLessThan(0);
  });

  it('reads EVEN for along-axis-only current (no cross component)', () => {
    const s = deriveCourseStrategy({ ...wind180, currentDirection: 180, currentSpeedKn: 1 });
    expect(s.upwind.favoredSide).toBe('even');
    expect(s.start.favoredEnd).toBe('even');
    expect(Math.abs(s.conditions.crossCurrentKn)).toBeLessThan(0.001);
    expect(s.conditions.alongCurrentKn).toBeGreaterThan(0.9); // pushing up the beat
  });

  it('reads EVEN when there is no meaningful current', () => {
    const s = deriveCourseStrategy({ ...wind180, currentDirection: 270, currentSpeedKn: 0.05 });
    expect(s.upwind.favoredSide).toBe('even');
    expect(s.start.favoredEnd).toBe('even');
  });

  it('reads EVEN when the cross component is below the side threshold', () => {
    // Current mostly along-axis, tiny cross: 0.2 kn set 30° off the wind axis.
    const s = deriveCourseStrategy({ ...wind180, currentDirection: 210, currentSpeedKn: 0.15 });
    expect(s.upwind.favoredSide).toBe('even');
  });
});

describe('deriveCourseStrategy — wind band modulation', () => {
  const cur = { currentDirection: 270, currentSpeedKn: 1 };
  it('classifies bands by wind speed', () => {
    expect(deriveCourseStrategy({ windDirection: 180, windSpeedKn: 5, ...cur }).conditions.band).toBe('light');
    expect(deriveCourseStrategy({ windDirection: 180, windSpeedKn: 12, ...cur }).conditions.band).toBe('medium');
    expect(deriveCourseStrategy({ windDirection: 180, windSpeedKn: 20, ...cur }).conditions.band).toBe('heavy');
    expect(deriveCourseStrategy({ windDirection: 180, ...cur }).conditions.band).toBe('unknown');
  });

  it('leans harder on the current side in light air', () => {
    const light = deriveCourseStrategy({ windDirection: 180, windSpeedKn: 5, ...cur });
    expect(light.upwind.summary).toMatch(/commit hard/i);
  });

  it('softens the current side in heavy air', () => {
    const heavy = deriveCourseStrategy({ windDirection: 180, windSpeedKn: 22, ...cur });
    expect(heavy.upwind.summary).toMatch(/matters less|never bury a shift/i);
  });
});

describe('deriveCourseStrategy — sections reference the favored side + thirds', () => {
  const s = deriveCourseStrategy({ windDirection: 180, windSpeedKn: 12, currentDirection: 270, currentSpeedKn: 1 });

  it('emits exactly bottom/middle/upper thirds for each leg, in order', () => {
    expect(s.upwind.thirds.map((t) => t.third)).toEqual(['bottom', 'middle', 'upper']);
    expect(s.downwind.thirds.map((t) => t.third)).toEqual(['bottom', 'middle', 'upper']);
  });

  it('names the favored side in every upwind third', () => {
    for (const t of s.upwind.thirds) expect(t.text).toMatch(/LEFT/);
  });

  it('names the favored side in the start and downwind summary', () => {
    expect(s.start.text).toMatch(/pin/i);
    expect(s.downwind.summary).toMatch(/LEFT/);
  });
});

describe('deriveCourseStrategy — shore context', () => {
  it('adds a shore-bend note for the named side when offshore data is supplied', () => {
    const s = deriveCourseStrategy({
      windDirection: 180,
      windSpeedKn: 12,
      currentDirection: 270,
      currentSpeedKn: 1,
      shoreSide: 'right',
    });
    expect(s.upwind.summary).toMatch(/RIGHT shore/);
  });

  it('omits the shore note when no shore side is given', () => {
    const s = deriveCourseStrategy({ windDirection: 180, windSpeedKn: 12, currentDirection: 270, currentSpeedKn: 1 });
    expect(s.upwind.summary).not.toMatch(/shore/i);
  });
});
