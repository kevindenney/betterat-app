-- =====================================================
-- Venue race courses
--
-- A venue/racing-area-scoped, reusable race course. Where
-- venue_racing_areas stores the soft "where racing happens" blob, this
-- stores the *course geometry* — the start line, marks, laylines, and
-- start box a sailor needs to plan a beat. One racing area can own many
-- named courses (e.g. "Victoria Harbour — W/L short" / "…— long").
--
-- We persist only the small parameter set the geometry is derivable
-- from (committee/pin endpoints, wind axis, leg length, tack angle, boat
-- length, start-box depth) in course_geometry JSONB — see
-- CourseGeometryParams in types/courses.ts. The full overlay (windward/
-- leeward marks, finish, laylines, beat corridor, start box) is derived
-- at render time by lib/courseGeometry so stored geometry stays
-- internally consistent when wind changes.
--
-- RLS: public SELECT (it's a discovery surface, like venue_racing_areas),
-- owner-only write with auth.uid() wrapped per RLS perf guidance.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.venue_race_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- A course belongs to a racing area (preferred) and/or a venue. At
    -- least one anchor is required so the course can surface somewhere.
    racing_area_id UUID REFERENCES public.venue_racing_areas(id) ON DELETE CASCADE,
    venue_id TEXT,

    name TEXT NOT NULL,
    course_type TEXT NOT NULL DEFAULT 'windward_leeward' CHECK (course_type IN (
        'windward_leeward',
        'triangle',
        'olympic',
        'trapezoid',
        'custom'
    )),

    -- CourseGeometryParams (see types/courses.ts): committee/pin lat-lng,
    -- windDirectionDeg, legLengthNm, tackAngleDeg, boatLengthM,
    -- startBoxDepthBoatLengths, courseType.
    course_geometry JSONB NOT NULL,

    classes_used TEXT[],  -- e.g. ['Dragon', 'J/80'] — for class-aware dimming

    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT venue_race_courses_has_anchor CHECK (
        racing_area_id IS NOT NULL OR venue_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_venue_race_courses_racing_area
    ON public.venue_race_courses(racing_area_id);
CREATE INDEX IF NOT EXISTS idx_venue_race_courses_venue
    ON public.venue_race_courses(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_race_courses_active
    ON public.venue_race_courses(is_active) WHERE is_active = true;

ALTER TABLE public.venue_race_courses ENABLE ROW LEVEL SECURITY;

-- Public read: courses are a discovery surface (Atlas renders them for
-- any sailor at a venue), same posture as venue_racing_areas.
DROP POLICY IF EXISTS "venue_race_courses_select" ON public.venue_race_courses;
CREATE POLICY "venue_race_courses_select" ON public.venue_race_courses
    FOR SELECT USING (true);

-- Owner write. auth.uid() wrapped in (SELECT ...) per RLS perf guidance.
DROP POLICY IF EXISTS "venue_race_courses_insert" ON public.venue_race_courses;
CREATE POLICY "venue_race_courses_insert" ON public.venue_race_courses
    FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "venue_race_courses_update" ON public.venue_race_courses;
CREATE POLICY "venue_race_courses_update" ON public.venue_race_courses
    FOR UPDATE USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "venue_race_courses_delete" ON public.venue_race_courses;
CREATE POLICY "venue_race_courses_delete" ON public.venue_race_courses
    FOR DELETE USING (created_by = (SELECT auth.uid()));

-- Reuse the generic NOW() setter installed by the venue_racing_areas
-- migration; no need for a second identical function.
CREATE TRIGGER venue_race_courses_updated_at
    BEFORE UPDATE ON public.venue_race_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_venue_racing_areas_updated_at();

COMMENT ON TABLE public.venue_race_courses IS
    'Venue/racing-area-scoped reusable race courses. Stores CourseGeometryParams in course_geometry JSONB; full overlay derived at render time by lib/courseGeometry.';
COMMENT ON COLUMN public.venue_race_courses.course_geometry IS
    'CourseGeometryParams: committee/pin lat-lng, windDirectionDeg (wind FROM), legLengthNm, tackAngleDeg, boatLengthM, startBoxDepthBoatLengths, courseType.';
