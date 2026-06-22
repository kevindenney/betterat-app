/**
 * NetflixLandingPage — faithful RN-web port of public/betterat-landing-netflix.html.
 * Self-contained: own nav, anchor scroll (web), all marketing sections + footer.
 * Web-only surface (native redirects to /login from app/index.tsx).
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BetterAtLogo } from '@/components/BetterAtLogo';
import { ScrollFix } from './ScrollFix';

// ── palette (mirrors :root in the mock) ──────────────────────────────
const C = {
  bg: '#ffffff',
  band: '#f1f6fd',
  bandWarm: '#fdf8f1',
  card: '#ffffff',
  line: '#e2e5ec',
  lineSoft: '#edeff4',
  txt: '#1b1d23',
  txt2: '#5c616b',
  txt3: '#8b909a',
  blue: '#2d7ff9',
  blueD: '#1c6df0',
  orange: '#a8554a',
  orangeL: '#c66b56',
  orangeInk: '#8a4035',
  green: '#34c759',
  greenInk: '#1d8d3f',
  purple: '#bf5af2',
};
const PLAN = C.blue;
const DO = C.orange;
const REVIEW = C.green;

const FONT = Platform.select({
  web: "Figtree, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
  default: 'System',
}) as string;
const MONO = Platform.select({
  web: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  default: 'Menlo',
}) as string;
const SERIF = Platform.select({
  web: "Georgia, 'Times New Roman', serif",
  default: 'Georgia',
}) as string;

const MAXW = 1180;

function useFigtree() {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.getElementById('betterat-figtree')) return;
    const l = document.createElement('link');
    l.id = 'betterat-figtree';
    l.rel = 'stylesheet';
    l.href =
      'https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&family=Manrope:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }, []);
}

const scrollToId = (id: string) => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
const openUrl = (url: string) => {
  Linking.openURL(url).catch(() => {});
};
const goRoute = (route: string) => router.push(route as never);

// ── small shared atoms ───────────────────────────────────────────────
function Wrap({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.wrap, style]}>{children}</View>;
}
function Dot({ color = C.blue, size = 8 }: { color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

function Intro({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <View style={s.intro}>
      <Text style={s.kicker}>{kicker}</Text>
      <Text style={s.h2}>{title}</Text>
      {sub ? <Text style={s.introSub}>{sub}</Text> : null}
    </View>
  );
}

// ── app-screen frame (browser chrome around a mock of the real app) ──
function Frame({
  caption,
  capColor,
  children,
}: {
  caption: string;
  capColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.frame}>
      <View style={s.frameBar}>
        <View style={s.frameTl}>
          <View style={[s.frameTlDot, { backgroundColor: '#ff5f57' }]} />
          <View style={[s.frameTlDot, { backgroundColor: '#febc2e' }]} />
          <View style={[s.frameTlDot, { backgroundColor: '#28c840' }]} />
        </View>
        <View style={s.frameUrl}>
          <Text style={s.frameUrlLock}>🔒</Text>
          <Text style={s.frameUrlText}>betterat.app/practice</Text>
        </View>
      </View>
      <View style={s.frameBody}>
        <View style={s.mk}>{children}</View>
        <View style={s.frameCap}>
          <Dot color={capColor} size={7} />
          <Text style={s.frameCapText}>{caption}</Text>
        </View>
      </View>
    </View>
  );
}

// phase tab row used across all four frames
function MkTabs({ active }: { active: 'plan' | 'do' | 'review' | 'discuss' }) {
  const tab = (key: 'plan' | 'do' | 'review' | 'discuss', n: string, label: string, color: string) => {
    const on = active === key;
    const passed =
      ['plan', 'do', 'review', 'discuss'].indexOf(key) < ['plan', 'do', 'review', 'discuss'].indexOf(active);
    return (
      <View style={s.mkTab} key={key}>
        <View style={[s.mkTabB, on && { backgroundColor: color, borderWidth: 0 }, passed && { backgroundColor: C.green, borderWidth: 0 }]}>
          <Text style={[s.mkTabBText, (on || passed) && { color: '#fff', fontWeight: '700' }]}>
            {passed ? '✓' : n}
          </Text>
        </View>
        <Text style={[s.mkTabLabel, on && { color: C.txt }]}>{label}</Text>
      </View>
    );
  };
  return (
    <View style={s.mkTabs}>
      {tab('plan', '1', 'Plan', PLAN)}
      {tab('do', '2', 'Do', DO)}
      {tab('review', '3', 'Review', REVIEW)}
      {tab('discuss', '💬', 'Discuss', C.purple)}
    </View>
  );
}

export function NetflixLandingPage() {
  useFigtree();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const w = mounted ? width : 1200;
  const navLinks = w > 820;

  return (
    <View style={s.root}>
      {Platform.OS === 'web' && <ScrollFix />}

      {/* top blue-tint backdrop (mirrors the mock's body gradient) */}
      <LinearGradient
        colors={['rgba(45,127,249,0.09)', 'rgba(45,127,249,0.03)', 'rgba(45,127,249,0)']}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={s.heroBackdrop}
      />

      {/* NAV */}
      <View style={s.nav}>
        <View style={s.navInner}>
          <Pressable style={s.brand} onPress={() => scrollToId('top')}>
            <BetterAtLogo size={26} />
            <Text style={s.brandText}>BetterAt</Text>
          </Pressable>
          {navLinks && (
            <View style={s.navLinks}>
              <Pressable onPress={() => scrollToId('blueprint')}><Text style={s.navLink}>Blueprints</Text></Pressable>
              <Pressable onPress={() => scrollToId('orgs')}><Text style={s.navLink}>Organizations</Text></Pressable>
              <Pressable onPress={() => scrollToId('interests')}><Text style={s.navLink}>Interests</Text></Pressable>
              <Pressable onPress={() => scrollToId('apps')}><Text style={s.navLink}>Apps</Text></Pressable>
              <Pressable onPress={() => scrollToId('pricing')}><Text style={s.navLink}>Pricing</Text></Pressable>
              <Pressable style={s.navGive} onPress={() => scrollToId('access')}>
                <Text style={s.navGiveB1}>1%</Text>
                <Text style={s.navGiveText}>for Access</Text>
              </Pressable>
            </View>
          )}
          <View style={s.navCta}>
            <Pressable onPress={() => goRoute('/login')}><Text style={s.signin}>Sign in</Text></Pressable>
            <Pressable style={s.pillBtn} onPress={() => goRoute('/signup')}>
              <Text style={s.pillBtnText}>Start free</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* HERO */}
      <View nativeID="top" style={s.hero}>
        <Wrap>
          <Text style={s.h1}>
            Get measurably better at <Text style={s.h1Em}>anything</Text> you practice.
          </Text>
          <Text style={s.lede}>
            It starts with one real path — a <Text style={s.b}>Dragon World Championship</Text>{' '}
            race-week plan, broken into steps you actually work. Subscribe and they drop into your
            timeline, one Plan → Do → Review at a time.
          </Text>
          <View style={s.ctaRow}>
            <Pressable style={s.btnFill} onPress={() => scrollToId('blueprint')}>
              <Text style={s.btnFillText}>Get the Dragon Worlds blueprint</Text>
            </Pressable>
            <Pressable onPress={() => scrollToId('orgs')}>
              <Text style={s.btnLink}>For organizations ›</Text>
            </Pressable>
          </View>
          <View style={s.heroMeta}>
            {[
              [<Text key="a"><Text style={s.metaB}>Free</Text> for Dragon Worlds participants</Text>],
              [<Text key="b">The <Text style={s.metaB}>first blueprint</Text> — more as authors join</Text>],
              [<Text key="c"><Text style={s.metaB}>85%</Text> goes to the author</Text>],
            ].map((node, i) => (
              <View key={i} style={s.metaItem}>
                <Dot size={5} />
                <Text style={s.metaText}>{node}</Text>
              </View>
            ))}
          </View>

          {/* SIGNATURE TIMELINE — four app-screen frames */}
          <View style={s.stage}>
            <View style={s.stageHead}>
              <View style={s.chip}>
                <Dot color={PLAN} />
                <Text style={s.chipText}>
                  Sail Racing <Text style={s.chipCar}>· Dragon World Championship</Text>
                </Text>
              </View>
              <View style={s.legend}>
                <View style={s.legendItem}><Dot color={REVIEW} /><Text style={s.legendText}>Done</Text></View>
                <View style={s.legendItem}><Dot color={DO} /><Text style={s.legendText}>Now</Text></View>
                <View style={s.legendItem}><Dot color={PLAN} /><Text style={s.legendText}>Planned</Text></View>
              </View>
            </View>

            <View style={s.shots}>
              {/* PLAN */}
              <Frame caption="Plan · the step, broken down" capColor={PLAN}>
                <Text style={s.mkTitle}>Tune the rig for race-day breeze</Text>
                <MkTabs active="plan" />
                <View style={s.mkToggle}>
                  <View style={[s.mkOpt, s.mkOptSel]}>
                    <View style={s.mkTick}><Text style={s.mkTickText}>✓</Text></View>
                    <Text style={s.mkOptEm}>📍</Text>
                    <Text style={[s.mkOptT, { color: PLAN }]}>Step</Text>
                    <Text style={s.mkOptD}>Anything you do — practice, boat work, a debrief.</Text>
                  </View>
                  <View style={s.mkOpt}>
                    <Text style={s.mkOptEm}>⛵</Text>
                    <Text style={s.mkOptT}>Race</Text>
                    <Text style={s.mkOptD}>An event on a course. Gets Atlas course & marks.</Text>
                  </View>
                </View>
                <View style={s.mkCard}>
                  <Text style={s.mkLbl}>💡 WHAT WILL YOU DO?</Text>
                  <Text style={s.mkVal}>Set base + 2 for the 12–15 kt forecast</Text>
                  <Text style={s.mkAi}>✨ Open AI Coach</Text>
                </View>
                <View style={s.mkCard}>
                  <Text style={s.mkLbl}>☰ HOW WILL YOU DO IT?</Text>
                  {['Set shroud tension to base + 2', 'Mark spreader deflection at the dock', 'Log the numbers in the tuning guide'].map((t, i) => (
                    <View key={i} style={s.mkSub}>
                      <Text style={s.mkSubN}>{i + 1}.</Text>
                      <Text style={[s.mkSubF, i === 2 && s.mkSubFph]}>{t}</Text>
                    </View>
                  ))}
                  <Text style={s.mkAct}>⊕ Add sub-step</Text>
                </View>
                <View style={s.mkCard}>
                  <Text style={s.mkLbl}>👥 WITH WHOM?</Text>
                  <Text style={s.mkAct}>👤＋ Add your crew</Text>
                </View>
              </Frame>

              {/* DO */}
              <Frame caption="Do · capture in the moment" capColor={DO}>
                <Text style={s.mkTitle}>Tune the rig for race-day breeze</Text>
                <View style={s.mkMeta}>
                  <Text style={s.mkMchip}>◆ 2 near</Text>
                  <Text style={s.mkMchip}>🔗 1 yours</Text>
                </View>
                <MkTabs active="do" />
                <View style={s.mkCard}>
                  <Text style={[s.mkLbl, { color: PLAN }]}>CAPTURE EVIDENCE</Text>
                  <View style={s.mkField}>
                    <Text style={s.mkFieldText}>Jot a quick note…</Text>
                    <View style={s.mkSend}><Text style={s.mkSendText}>↑</Text></View>
                  </View>
                  <View style={s.mkRow2}>
                    <View style={s.mkBtn}><Text style={s.mkBtnText}>🎙 Voice</Text></View>
                    <View style={s.mkBtn}><Text style={s.mkBtnText}>📷 Photo or video</Text></View>
                  </View>
                  <View style={s.mkPrimary}><Text style={s.mkPrimaryText}>Move to Reflect →</Text></View>
                </View>
                <View style={s.mkNote}>
                  <Text style={s.mkNoteText}>Base + 2 held the rig steady through 14 kts. Forestay felt right off the line — a touch loose in the top puffs.</Text>
                  <Text style={s.mkWho}>Captured 13:42 · on the water</Text>
                </View>
                <View style={s.mkCard}>
                  <Text style={s.mkLbl}>☰ HOW</Text>
                  <Text style={s.mkHint}>Set base + 2 · mark spreaders · log the numbers.</Text>
                </View>
              </Frame>

              {/* REVIEW */}
              <Frame caption="Review · the AI writes the first draft" capColor={REVIEW}>
                <Text style={s.mkTitle}>Tune the rig for race-day breeze</Text>
                <View style={s.mkMeta}>
                  <Text style={s.mkMchip}>◆ 2 near</Text>
                  <Text style={s.mkMchip}>🔗 1 yours</Text>
                  <Text style={s.mkMchip}>📖 playbook</Text>
                </View>
                <MkTabs active="review" />
                <View style={s.mkBadge}><Text style={s.mkBadgeText}>✓ Settled</Text></View>
                <View style={s.mkDraft}>
                  <Text style={s.mkDraftH}>✨ DRAFT FROM YOUR CAPTURES</Text>
                  <Text style={s.mkDraftX}>Have a first draft from your 1 capture? Tap to draft, or write your own.</Text>
                  <Text style={s.mkDraftCta}>Tap to draft →</Text>
                </View>
                <View style={s.mkCard}>
                  <Text style={s.mkLbl}>WHAT WORKED?</Text>
                  <Text style={s.mkSeed}>
                    <Text style={s.mkSeedB}>Seed: </Text>
                    Your capture says base + 2 held steady through 14 kts and the forestay felt right off the line. The tune carried the boat upwind.
                  </Text>
                </View>
                <View style={s.mkCard}>
                  <Text style={s.mkLbl}>WHAT WOULD YOU DO DIFFERENTLY?</Text>
                  <Text style={[s.mkVal, { fontSize: 12.5 }]}>Add half a turn for the puffy top of the range.</Text>
                </View>
              </Frame>

              {/* DISCUSS */}
              <Frame caption="Discuss · talk it through with people" capColor={C.purple}>
                <Text style={s.mkTitle}>Tune the rig for race-day breeze</Text>
                <View style={s.mkMeta}>
                  <Text style={s.mkMchip}>💬 thread</Text>
                </View>
                <MkTabs active="discuss" />
                <View style={s.mkCard}>
                  <Text style={[s.mkLbl, { color: C.purple }]}>TALK IT THROUGH</Text>
                  <View style={s.mkCmt}>
                    <View style={s.mkAv}><Text style={s.mkAvText}>KD</Text></View>
                    <View style={s.mkCmtBd}>
                      <Text style={s.mkCmtNm}>Kevin Denney <Text style={s.mkCmtNmSpan}>· author</Text></Text>
                      <Text style={s.mkCmtTx}>Base + 2 is my go-to for 12–15. If it goes soft before the start, drop back to base — you'll point higher off the line.</Text>
                    </View>
                  </View>
                  <View style={s.mkField}>
                    <Text style={s.mkFieldText}>Add a comment…</Text>
                    <View style={s.mkSend}><Text style={s.mkSendText}>↑</Text></View>
                  </View>
                  <Text style={s.mkInvite}>Subscribe the blueprint and bring your crew — the thread is where a step turns into a conversation.</Text>
                </View>
              </Frame>
            </View>
          </View>
        </Wrap>
      </View>

      {/* APPS + DATA ACCESS */}
      <View nativeID="apps" style={s.section}>
        <Wrap>
          <View style={s.platformHead}>
            <Text style={s.kicker}>Use BetterAt anywhere</Text>
            <Text style={[s.h2, { textAlign: 'left' }]}>One practice timeline, on every screen you use.</Text>
            <Text style={s.platformP}>
              Capture on your phone in the moment, find what's happening around you on the web, and
              reach BetterAt from the tools you already use.
            </Text>
            <View style={s.downloadRow}>
              <Pressable style={[s.storeBtn, s.storeBtnPrimary]} onPress={() => openUrl('https://apps.apple.com/app/betterat')}>
                <View style={[s.storeIco, { backgroundColor: 'rgba(255,255,255,.18)' }]}><Text style={s.storeIcoText}>iOS</Text></View>
                <Text style={[s.storeBtnText, { color: '#fff' }]}>Download for iPhone</Text>
              </Pressable>
              <Pressable style={s.storeBtn} onPress={() => openUrl('https://play.google.com/store/apps/details?id=at.better.app')}>
                <View style={s.storeIco}><Text style={s.storeIcoText}>A</Text></View>
                <Text style={s.storeBtnText}>Get the Android app</Text>
              </Pressable>
              <Pressable style={s.storeBtn} onPress={() => goRoute('/signup')}>
                <View style={s.storeIco}><Text style={s.storeIcoText}>Web</Text></View>
                <Text style={s.storeBtnText}>Open the web app</Text>
              </Pressable>
            </View>
          </View>
          <View style={s.anywhereFeats}>
            {[
              { ic: '🔌', bg: 'rgba(45,127,249,.1)', h: 'Plug into your AI', p: <Text>Connect BetterAt over <Text style={s.featB}>MCP</Text> to Claude, ChatGPT, or your favorite AI — ask about your timeline and capture steps right from the chat.</Text> },
              { ic: '💬', bg: 'rgba(42,171,238,.14)', h: 'Telegram on the go', p: <Text>Message the <Text style={s.featB}>BetterAt bot</Text> to log and review on the move, and get tailored notifications on your phone.</Text> },
              { ic: '📤', bg: 'rgba(52,199,89,.14)', h: 'Your data is portable', p: <Text>Export everything any time. No lock-in — your full practice history is always yours to take.</Text> },
            ].map((f) => (
              <View key={f.h} style={s.afeat}>
                <View style={[s.afeatAi, { backgroundColor: f.bg }]}><Text style={{ fontSize: 19 }}>{f.ic}</Text></View>
                <Text style={s.afeatH}>{f.h}</Text>
                <Text style={s.afeatP}>{f.p}</Text>
              </View>
            ))}
          </View>
        </Wrap>
      </View>

      {/* THE FIRST BLUEPRINT */}
      <View nativeID="blueprint" style={[s.section, s.band]}>
        <Wrap>
          <Intro
            kicker="The first blueprint"
            title="One real path, broken into steps"
            sub="BetterAt is launching with a single author-owned blueprint — the Dragon World Championship race-week prep. Subscribe and every step lands in your timeline, one Plan → Do → Review at a time."
          />
          <View style={s.bpFeature}>
            <View style={s.bp}>
              <View style={s.bpTop}>
                <Text style={s.bpTag}>Sail Racing · 9 steps</Text>
                <Text style={[s.bpBadge, s.bpBadgeFree]}>First blueprint</Text>
              </View>
              <Text style={s.bpH3}>Dragon World Championship — race-week prep</Text>
              <View style={s.bpAuthor}>
                <View style={[s.bpAv, { backgroundColor: C.blue }]}><Text style={s.bpAvText}>KD</Text></View>
                <Text style={s.bpAuthorText}>Kevin Denney · author</Text>
              </View>
              <View style={s.miniScroll}>
                {[
                  { ph: 'Review', col: REVIEW, t: 'Measure & log boat vs. minimums', sub: 'scrutineering', pc: C.greenInk },
                  { ph: 'Do', col: DO, t: 'Tuning matrix · 8–22 kt', sub: 'two practice days', pc: C.orangeInk },
                  { ph: 'Plan', col: PLAN, t: 'Start-line routine & bias drill', sub: 'timed runs', pc: PLAN },
                  { ph: 'Plan', col: PLAN, t: 'Debrief race 1 · speed vs. fleet', sub: 'with your coach', pc: PLAN },
                ].map((m, i) => (
                  <View key={i} style={s.miniStep}>
                    <View style={[s.miniNode, { backgroundColor: m.col }]} />
                    <View style={s.miniCard}>
                      <Text style={[s.miniPill, { color: m.pc }]}>{m.ph.toUpperCase()}</Text>
                      <Text style={s.miniT}>{m.t}</Text>
                      <Text style={s.miniS}>{m.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.bpAccess}>
              <Text style={s.bpAccessH4}>Free for Dragon Worlds participants</Text>
              <Text style={s.bpAccessP}>Racing the championship? Enter your event code and the full blueprint is yours — every step drops straight into your timeline.</Text>
              <Pressable
                style={s.joinBtn}
                onPress={() => goRoute('/blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1')}
              >
                <Text style={s.joinBtnText}>Open the Dragon Worlds blueprint</Text>
              </Pressable>
              <View style={s.bpDivider}><View style={s.bpDividerLine} /><Text style={s.bpDividerText}>or</Text><View style={s.bpDividerLine} /></View>
              <Pressable
                style={s.joinAlt}
                onPress={() => goRoute('/signup?returnTo=%2Fblueprint%2Fdragon-worlds-2027-peak-performance%3Fauto_subscribe%3D1')}
              >
                <Text style={s.joinAltText}>Join BetterAt to subscribe</Text>
              </Pressable>
              <Text style={s.bpNote}>Not racing? Subscribe by joining BetterAt · 85% goes to the author</Text>
            </View>
          </View>
        </Wrap>
      </View>

      {/* FOR ORGANIZATIONS */}
      <View nativeID="orgs" style={s.section}>
        <Wrap>
          <Intro
            kicker="For organizations"
            title="Run a club, school, or program? Claim it."
            sub="BetterAt verifies organizations through their official domain. Once you claim yours, you can publish blueprints, run cohorts, and verify your members — in your field's own vocabulary."
          />
          <View style={s.claim}>
            <View style={s.claimSteps}>
              {[
                ['1', 'Verify your domain', "Prove you officially represent the organization with an authorized email or DNS record. No one gets listed until they've verified."],
                ['2', 'Publish blueprints', "Turn your curriculum or training plan into steps members can subscribe to — Plan → Do → Review, in your craft's words."],
                ['3', 'Run cohorts & verify members', "Move a group through together and confirm who's really in your program. You set the price; 85% stays with you."],
              ].map(([n, h, p]) => (
                <View key={n} style={s.cstep}>
                  <View style={s.cn}><Text style={s.cnText}>{n}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cstepH4}>{h}</Text>
                    <Text style={s.cstepP}>{p}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={s.claimCta}>
              <Text style={s.claimCtaH4}>Built for organizations like…</Text>
              <View style={s.aud}>
                {['⛵  Sailing & racing clubs', '✚  Nursing & health schools', '🌱  Livelihood & entrepreneurship NGOs', '🎓  Counseling & training programs'].map((t) => (
                  <Text key={t} style={s.audTile}>{t}</Text>
                ))}
              </View>
              <Pressable style={[s.btnFill, { width: '100%', marginTop: 8 }]} onPress={() => goRoute('/schools/start-pilot')}>
                <Text style={s.btnFillText}>Claim your organization</Text>
              </Pressable>
              <Text style={s.bpNote}>We're onboarding founding organizations now. These are the kinds of orgs BetterAt is built for — not a list of current members.</Text>
            </View>
          </View>
        </Wrap>
      </View>

      {/* INTERESTS RAIL */}
      <View nativeID="interests" style={[s.section, s.bandWarm]}>
        <Wrap>
          <Intro
            kicker="One engine, many crafts"
            title="Sailing today. Built to generalize."
            sub="BetterAt is launching in sail racing. The same engine — steps, blueprints, cohorts, reflection — is designed to re-skin to any field's vocabulary. Here's where it's headed."
          />
        </Wrap>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.rail}
          contentContainerStyle={s.railTrack}
        >
          <Pressable style={s.interest} onPress={() => scrollToId('blueprint')}>
            <View style={[s.ic, { backgroundColor: 'rgba(45,127,249,0.1)' }]}><Text style={s.icEmoji}>⛵</Text></View>
            <Text style={s.interestH3}>Sail Racing</Text>
            <Text style={s.orgName}>The Dragon Worlds prep blueprint</Text>
            <View style={s.interestFoot}>
              <View style={[s.status, s.statusLive]}><Dot color={C.green} size={6} /><Text style={s.statusLiveText}>Live now</Text></View>
              <Text style={s.interestOpen}>›</Text>
            </View>
          </Pressable>
          {[
            ['rgba(52,199,89,0.12)', '✚', 'Nursing', 'Clinical skills & precepting'],
            ['rgba(52,199,89,0.12)', '🌱', 'Livelihoods', 'Smallholder & entrepreneur training'],
            ['rgba(191,90,242,0.12)', '🎓', 'College Admissions', 'Application-cycle coaching'],
            ['rgba(255,159,10,0.12)', '🏋️', 'Health & Fitness', 'Strength & conditioning blocks'],
            ['rgba(45,127,249,0.1)', '🌍', 'Global Health', 'Field & community health'],
          ].map(([bg, emoji, title, org]) => (
            <View key={title} style={[s.interest, s.interestSoon]}>
              <View style={[s.ic, { backgroundColor: bg }]}><Text style={s.icEmoji}>{emoji}</Text></View>
              <Text style={s.interestH3}>{title}</Text>
              <Text style={s.orgName}>{org}</Text>
              <View style={s.interestFoot}>
                <View style={[s.status, s.statusSoon]}><Text style={s.statusSoonText}>On the roadmap</Text></View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* FOUR MOVES */}
      <View style={s.section}>
        <Wrap>
          <Intro kicker="One engine, every domain" title="Four moves. Every craft, the same shape." />
          <View style={s.movesGrid}>
            {[
              ['01', 'you add', 'Interests', "Whatever you're getting better at. Each opens its own marketplace of orgs, blueprints and people — in its own words."],
              ['02', 'you join', 'Organizations', 'Clubs, schools and co-ops that publish blueprints and run cohorts. Join and the structure experts use comes with it.'],
              ['03', 'you subscribe to', 'Blueprints', "A practitioner's path, broken into steps. Subscribe and each step lands in your timeline — Plan → Do → Review."],
              ['04', 'you follow', 'People', 'Coaches, mentors and peers whose steps you can adapt in one tap — and whose guidance becomes your next step.'],
            ].map(([n, verb, key, p]) => (
              <View key={n} style={s.move}>
                <Text style={s.moveN}>{n}</Text>
                <Text style={s.moveVerb}>{verb}</Text>
                <Text style={s.moveH4}><Text style={s.moveKey}>{key}</Text></Text>
                <Text style={s.moveP}>{p}</Text>
              </View>
            ))}
          </View>
        </Wrap>
      </View>

      {/* THE AUTHOR */}
      <View style={[s.section, s.band]}>
        <Wrap>
          <Intro
            kicker="Follow people"
            title="One author to start — maybe the next is you"
            sub="No feed of strangers. BetterAt has a single author today: the practitioner behind the Dragon Worlds blueprint. As people you trust join, you'll follow their steps and adapt them into your own plan."
          />
          <View style={s.authorCard}>
            <View style={s.personTop}>
              <View style={[s.pav, { backgroundColor: C.blue }]}><Text style={s.pavText}>KD</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pn}>Kevin Denney</Text>
                <Text style={s.pr}>Author · Sail Racing</Text>
              </View>
              <View style={s.roleTagAuthor}><Text style={s.roleTagAuthorText}>Author</Text></View>
            </View>
            <Text style={s.authorBody}>
              Kevin authored the Dragon World Championship race-week blueprint — the first path on BetterAt.{' '}
              <Text style={s.phNote}>Add your note here: why you built it and who it's for.</Text>
            </Text>
            <View style={s.personFoot}>
              <Text style={s.pstat}>1 blueprint · the first of many</Text>
              <Pressable style={s.follow} onPress={() => openUrl('mailto:hello@betterat.app?subject=Become%20a%20BetterAt%20author')}>
                <Text style={s.followText}>Become an author</Text>
              </Pressable>
            </View>
          </View>
        </Wrap>
      </View>

      {/* PRICING */}
      <View nativeID="pricing" style={s.section}>
        <Wrap>
          <Intro
            kicker="Pricing"
            title="Two things you can pay for — kept separate"
            sub="The platform plan powers your tools. The blueprint pays the author. They never get confused."
          />
          <View style={s.priceGrid}>
            <View style={[s.priceCard, s.priceCardFeature]}>
              <View style={[s.priceIcon, { backgroundColor: 'rgba(168,85,74,0.14)' }]}><Text style={s.icEmoji}>⚡</Text></View>
              <Text style={s.priceH3}>Your BetterAt plan</Text>
              <Text style={s.priceTiers}>
                <Text style={s.priceTiersB}>Free</Text> · Plus <Text style={s.priceTiersB}>$9/mo</Text> · Pro <Text style={s.priceTiersB}>$29/mo</Text>
              </Text>
              <View style={s.priceFeat}>
                {['Unlimited interests & steps', 'AI insights, capture & the Telegram assistant', 'Atlas map, analytics & offline'].map((f) => (
                  <View key={f} style={s.priceFeatLi}>
                    <View style={s.check}><Text style={s.checkText}>✓</Text></View>
                    <Text style={s.priceFeatText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.priceNote}>Billed by BetterAt. Powers the app, not the content.</Text>
            </View>
            <View style={s.priceCard}>
              <View style={[s.priceIcon, { backgroundColor: 'rgba(0,113,227,0.12)' }]}><Text style={s.icEmoji}>📦</Text></View>
              <Text style={s.priceH3}>The Dragon Worlds blueprint</Text>
              <Text style={s.priceTiers}>
                <Text style={s.priceTiersB}>Free</Text> with your participant code
              </Text>
              <View style={s.priceFeat}>
                {[
                  "Racing the championship? Enter your code — it's free",
                  'Everyone else subscribes by joining BetterAt',
                  '85% to the author · 15% platform',
                ].map((f) => (
                  <View key={f} style={s.priceFeatLi}>
                    <View style={s.check}><Text style={s.checkText}>✓</Text></View>
                    <Text style={s.priceFeatText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.priceNote}>One author, one blueprint today. Subscriptions are billed through the author's Stripe Connect account.</Text>
            </View>
          </View>
        </Wrap>
      </View>

      {/* 1% FOR ACCESS */}
      <View nativeID="access" style={[s.section, s.band]}>
        <Wrap>
          <Intro
            kicker="1% for Access"
            title="One percent, set aside from day one"
            sub="Inspired by 1% for the Planet: 1% of BetterAt's revenue funds subsidized access for people who'd grow the most with a coach in their pocket — but can't pay for one."
          />
          <View style={s.giveGrid}>
            <View style={s.giveLeft}>
              <View style={s.giveBadge}>
                <Text style={s.giveBadgePct}>1%</Text>
                <Text style={s.giveBadgeFor}>For Access</Text>
              </View>
              <Text style={s.giveLeftH2}>The tool shouldn't only reach people who can already afford a coach.</Text>
              <Text style={s.giveLeftP}>Mastery compounds. The earlier and wider the access, the bigger the difference a deliberate-practice habit makes over a life. So a fixed slice comes off the top — not leftover profit, a standing commitment — to put BetterAt in more hands.</Text>
              <Text style={s.giveLeftP}>It funds two groups first, and grows as we do.</Text>
            </View>
            <View style={s.giveCards}>
              {[
                ['rgba(0,113,227,0.12)', '🎓', 'High-school students', 'Schools can apply for subsidized access for their students — so a teenager learning to practice on purpose gets the same tools as anyone training for a championship.', 'Schools apply →', '/schools/start-pilot'],
                ['rgba(52,199,89,0.14)', '🌱', 'Rural entrepreneurs', 'NGOs and livelihood programs can apply to bring subsidized access to the entrepreneurs they support — turning a blueprint into a step-by-step path in their own vocabulary.', 'NGOs apply →', '/schools/start-pilot'],
              ].map(([bg, emoji, h, p, tag, href]) => (
                <View key={h} style={s.giveCard}>
                  <View style={[s.gi, { backgroundColor: bg }]}><Text style={s.icEmoji}>{emoji}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.giveCardH4}>{h}</Text>
                    <Text style={s.giveCardP}>{p}</Text>
                    <Pressable onPress={() => goRoute(href)}><Text style={s.gtag}>{tag}</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={s.giveFoot}>
            <Pressable style={s.btnFill} onPress={() => goRoute('/schools/start-pilot')}>
              <Text style={s.btnFillText}>Apply for subsidized access</Text>
            </Pressable>
            <Text style={s.gnote}>For schools and NGOs. We review every application by hand — there's no automated funnel yet, and that's on purpose.</Text>
          </View>
        </Wrap>
      </View>

      {/* FINAL CTA */}
      <View style={[s.final, s.bandWarm]}>
        <Wrap>
          <Text style={s.finalH2}>Prepping for <Text style={s.finalH2Em}>Dragon Worlds</Text>? Start with the blueprint.</Text>
          <Text style={s.finalP}>Enter your participant code for the free race-week plan — or join BetterAt to subscribe and put the first step in your timeline today.</Text>
          <View style={s.finalCtaRow}>
            <Pressable style={s.btnFill} onPress={() => scrollToId('blueprint')}>
              <Text style={s.btnFillText}>Get the blueprint</Text>
            </Pressable>
            <Pressable onPress={() => goRoute('/schools/start-pilot')}>
              <Text style={s.btnLink}>Claim your organization ›</Text>
            </Pressable>
          </View>
        </Wrap>
      </View>

      {/* FOOTER */}
      <View style={s.footer}>
        <Wrap>
          <View style={s.footGrid}>
            <View style={s.footBrand}>
              <View style={s.brand}>
                <BetterAtLogo size={26} />
                <Text style={s.brandText}>BetterAt</Text>
              </View>
              <Text style={s.footBrandP}>Get measurably better at anything you practice. One model for every craft — interests, organizations, blueprints and people.</Text>
            </View>
            <View style={s.footCol}>
              <Text style={s.footColH5}>Product</Text>
              <Pressable onPress={() => scrollToId('interests')}><Text style={s.footColA}>Interests</Text></Pressable>
              <Pressable onPress={() => goRoute('/marketplace')}><Text style={s.footColA}>Marketplace</Text></Pressable>
              <Pressable onPress={() => goRoute('/how-it-works')}><Text style={s.footColA}>How it works</Text></Pressable>
              <Pressable onPress={() => scrollToId('pricing')}><Text style={s.footColA}>Pricing</Text></Pressable>
            </View>
            <View style={s.footCol}>
              <Text style={s.footColH5}>For orgs</Text>
              <Pressable onPress={() => goRoute('/schools/pricing')}><Text style={s.footColA}>Institutional plans</Text></Pressable>
              <Pressable onPress={() => openUrl('mailto:hello@betterat.app?subject=Publish%20a%20BetterAt%20blueprint')}><Text style={s.footColA}>Publish a blueprint</Text></Pressable>
              <Pressable onPress={() => goRoute('/schools')}><Text style={s.footColA}>Run a cohort</Text></Pressable>
              <Pressable onPress={() => goRoute('/schools/start-pilot')}><Text style={s.footColA}>Verify your org</Text></Pressable>
            </View>
            <View style={s.footCol}>
              <Text style={s.footColH5}>Company</Text>
              <Pressable onPress={() => goRoute('/how-it-works')}><Text style={s.footColA}>About</Text></Pressable>
              <Pressable onPress={() => openUrl('mailto:hello@betterat.app?subject=Become%20a%20BetterAt%20author')}><Text style={s.footColA}>Authors</Text></Pressable>
              <Pressable onPress={() => goRoute('/terms')}><Text style={s.footColA}>Terms</Text></Pressable>
            </View>
          </View>
          <View style={s.footBottom}>
            <Text style={s.footBottomText}>© 2026 BetterAt · Reflection Network</Text>
            <Text style={s.footBottomMono}>DELIBERATE · PRACTICE · PLATFORM</Text>
          </View>
        </Wrap>
      </View>
    </View>
  );
}

const baseText: TextStyle = { fontFamily: FONT, color: C.txt };

const s = StyleSheet.create({
  root: { backgroundColor: C.bg, width: '100%' },
  wrap: { width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 22 },

  // NAV
  nav: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    ...(Platform.OS === 'web' ? ({ position: 'sticky', top: 0, zIndex: 60, backdropFilter: 'saturate(180%) blur(20px)' } as any) : {}),
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    paddingHorizontal: 22,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { ...baseText, fontSize: 18, fontWeight: '600', letterSpacing: -0.4, color: C.blue },
  navLinks: { flexDirection: 'row', gap: 30, alignItems: 'center' },
  navLink: { ...baseText, fontSize: 13, fontWeight: '400', opacity: 0.82 },
  navGive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navGiveB1: { fontFamily: FONT, backgroundColor: C.blue, color: '#fff', fontSize: 10.5, fontWeight: '700', borderRadius: 980, paddingVertical: 2, paddingHorizontal: 7, overflow: 'hidden' },
  navGiveText: { ...baseText, fontSize: 13, fontWeight: '600', color: C.blue },
  navCta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signin: { ...baseText, fontSize: 13, opacity: 0.82 },
  pillBtn: { backgroundColor: C.blue, borderRadius: 980, paddingVertical: 5, paddingHorizontal: 14 },
  pillBtnText: { fontFamily: FONT, fontSize: 13, color: '#fff' },

  // HERO
  heroBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 760 },
  hero: { paddingTop: 80, paddingBottom: 30, alignItems: 'center' },
  h1: { ...baseText, fontSize: 56, fontWeight: '600', letterSpacing: -1.5, lineHeight: 62, textAlign: 'center', maxWidth: 760, alignSelf: 'center' },
  h1Em: { color: C.blue },
  lede: { ...baseText, fontSize: 23, color: C.txt2, maxWidth: 540, alignSelf: 'center', textAlign: 'center', marginTop: 20, lineHeight: 31 },
  b: { fontWeight: '700', color: C.txt },
  ctaRow: { flexDirection: 'row', gap: 22, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 26 },
  btnFill: { backgroundColor: C.blue, borderRadius: 980, paddingVertical: 11, paddingHorizontal: 22 },
  btnFillText: { fontFamily: FONT, fontSize: 17, color: '#fff' },
  btnLink: { fontFamily: FONT, fontSize: 17, color: C.blue },
  heroMeta: { flexDirection: 'row', gap: 26, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap', rowGap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { ...baseText, fontSize: 14, color: C.txt3 },
  metaB: { color: C.txt2, fontWeight: '600' },

  // STAGE / signature timeline
  stage: { marginTop: 60, width: '100%' },
  stageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', rowGap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 13, borderRadius: 980, backgroundColor: C.band },
  chipText: { ...baseText, fontSize: 13, fontWeight: '500' },
  chipCar: { color: C.txt3, fontWeight: '400' },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...baseText, fontSize: 12, color: C.txt3 },
  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },

  // FRAME (browser chrome)
  frame: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.lineSoft, flexGrow: 1, flexBasis: 250, minWidth: 250, maxWidth: 420, height: 560, ...(Platform.OS === 'web' ? ({ boxShadow: '0 22px 60px rgba(28,40,64,.11)' } as any) : {}) },
  frameBar: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: '#f6f7fa', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  frameTl: { flexDirection: 'row', gap: 6 },
  frameTlDot: { width: 11, height: 11, borderRadius: 6 },
  frameUrl: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 7, height: 22, borderWidth: 1, borderColor: C.lineSoft, maxWidth: 300, alignSelf: 'center' },
  frameUrlLock: { fontSize: 9, opacity: 0.6 },
  frameUrlText: { fontFamily: MONO, fontSize: 11.5, color: C.txt3 },
  frameBody: { flex: 1, backgroundColor: '#fff', overflow: 'hidden' },
  frameCap: { position: 'absolute', left: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(27,29,35,.82)', paddingVertical: 5, paddingHorizontal: 11, borderRadius: 980 },
  frameCapText: { fontFamily: FONT, color: '#fff', fontSize: 12, fontWeight: '500' },

  // MOCK app UI
  mk: { flex: 1, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 70 },
  mkTitle: { fontFamily: SERIF, fontSize: 18, lineHeight: 21, fontWeight: '500', color: C.txt, marginBottom: 9 },
  mkMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: -3, marginBottom: 11 },
  mkMchip: { fontFamily: FONT, fontSize: 10.5, color: C.txt3, backgroundColor: '#f2f4f8', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 980, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden' },
  mkTabs: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.lineSoft, borderBottomWidth: 1, borderBottomColor: C.lineSoft, marginBottom: 12 },
  mkTab: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mkTabB: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  mkTabBText: { fontFamily: FONT, fontSize: 9, color: C.txt3 },
  mkTabLabel: { fontFamily: FONT, fontSize: 11.5, fontWeight: '600', color: C.txt3 },
  mkToggle: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  mkOpt: { flex: 1, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 12, padding: 11 },
  mkOptSel: { borderColor: PLAN, backgroundColor: '#eff5ff' },
  mkOptEm: { fontSize: 17 },
  mkOptT: { ...baseText, fontWeight: '700', fontSize: 13, marginTop: 3, marginBottom: 2 },
  mkOptD: { fontFamily: FONT, fontSize: 10.5, color: C.txt3, lineHeight: 14 },
  mkTick: { position: 'absolute', top: 9, right: 9, width: 16, height: 16, borderRadius: 8, backgroundColor: PLAN, alignItems: 'center', justifyContent: 'center' },
  mkTickText: { color: '#fff', fontSize: 9 },
  mkCard: { borderWidth: 1, borderColor: C.lineSoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 13, marginBottom: 11, backgroundColor: '#fff' },
  mkLbl: { fontFamily: FONT, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: C.txt3, marginBottom: 7 },
  mkVal: { ...baseText, fontSize: 14, marginBottom: 9 },
  mkAi: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: C.purple },
  mkSub: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  mkSubN: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: C.txt3, width: 14 },
  mkSubF: { flex: 1, backgroundColor: '#f4f6fa', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontFamily: FONT, fontSize: 11.5, color: C.txt },
  mkSubFph: { color: C.txt3 },
  mkAct: { fontFamily: FONT, fontSize: 12.5, fontWeight: '600', color: C.green },
  mkField: { backgroundColor: '#f4f6fa', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 9 },
  mkFieldText: { fontFamily: FONT, fontSize: 12.5, color: C.txt3 },
  mkSend: { position: 'absolute', right: 9, bottom: 9, width: 26, height: 26, borderRadius: 13, backgroundColor: PLAN, alignItems: 'center', justifyContent: 'center' },
  mkSendText: { color: '#fff', fontSize: 12 },
  mkRow2: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  mkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f2f4f8', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 9, paddingVertical: 9 },
  mkBtnText: { fontFamily: FONT, fontSize: 11.5, fontWeight: '600', color: C.txt2 },
  mkPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.blue, borderRadius: 11, paddingVertical: 12 },
  mkPrimaryText: { fontFamily: FONT, fontSize: 13.5, fontWeight: '700', color: '#fff' },
  mkNote: { backgroundColor: '#f7f9fc', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, marginBottom: 9 },
  mkNoteText: { fontFamily: FONT, fontSize: 11.5, color: C.txt2, lineHeight: 16 },
  mkWho: { fontFamily: FONT, fontSize: 10, color: C.txt3, marginTop: 4 },
  mkHint: { fontFamily: FONT, fontSize: 11, color: C.txt3, lineHeight: 15 },
  mkBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e9f9ef', borderWidth: 1, borderColor: '#c7eed4', borderRadius: 980, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 11 },
  mkBadgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: C.green },
  mkDraft: { backgroundColor: '#f3f0ff', borderWidth: 1, borderColor: '#e2dbff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 13, marginBottom: 12 },
  mkDraftH: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: C.purple, letterSpacing: 0.6, marginBottom: 6 },
  mkDraftX: { fontFamily: FONT, fontSize: 12, color: C.txt2, lineHeight: 17, fontStyle: 'italic', marginBottom: 8 },
  mkDraftCta: { fontFamily: FONT, fontSize: 12.5, fontWeight: '700', color: C.purple },
  mkSeed: { fontFamily: FONT, fontSize: 11.5, color: '#33415a', lineHeight: 17 },
  mkSeedB: { color: PLAN, fontWeight: '700' },
  mkCmt: { flexDirection: 'row', gap: 9, marginBottom: 11 },
  mkAv: { width: 26, height: 26, borderRadius: 13, backgroundColor: PLAN, alignItems: 'center', justifyContent: 'center' },
  mkAvText: { color: '#fff', fontSize: 9.5, fontWeight: '700', fontFamily: FONT },
  mkCmtBd: { flex: 1 },
  mkCmtNm: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: C.txt, marginBottom: 4 },
  mkCmtNmSpan: { fontWeight: '600', color: C.txt3 },
  mkCmtTx: { fontFamily: FONT, fontSize: 11.5, color: C.txt2, lineHeight: 16, backgroundColor: '#f7f9fc', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  mkInvite: { fontFamily: FONT, fontSize: 11, color: C.txt3, textAlign: 'center', lineHeight: 15, paddingTop: 9, paddingHorizontal: 6 },

  // SECTION shell
  section: { paddingTop: 90, paddingBottom: 70, width: '100%' },
  band: { backgroundColor: C.band },
  bandWarm: { backgroundColor: C.bandWarm },
  intro: { maxWidth: 720, alignSelf: 'center', alignItems: 'center', marginBottom: 8 },
  kicker: { fontFamily: FONT, fontSize: 19, fontWeight: '600', color: C.blue, marginBottom: 6 },
  h2: { ...baseText, fontSize: 44, fontWeight: '700', letterSpacing: -1.2, lineHeight: 47, textAlign: 'center' },
  introSub: { ...baseText, fontSize: 21, color: C.txt2, marginTop: 14, lineHeight: 29, textAlign: 'center' },

  // APPS
  platformHead: { maxWidth: 660, marginBottom: 30 },
  platformP: { ...baseText, fontSize: 17, color: C.txt2, lineHeight: 25, maxWidth: 520, marginTop: 12 },
  downloadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  storeBtn: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 980, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  storeBtnPrimary: { backgroundColor: C.blue, borderColor: C.blue },
  storeBtnText: { ...baseText, fontSize: 13, fontWeight: '700' },
  storeIco: { minWidth: 28, height: 22, borderRadius: 980, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(45,127,249,.1)', paddingHorizontal: 7 },
  storeIcoText: { fontFamily: FONT, fontSize: 12, color: C.txt },
  anywhereFeats: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 42, maxWidth: 1000, alignSelf: 'center' },
  afeat: { flexGrow: 1, flexBasis: 280, minWidth: 250, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 18, paddingVertical: 24, paddingHorizontal: 22, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  afeatAi: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  afeatH: { ...baseText, fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  afeatP: { ...baseText, fontSize: 13.5, color: C.txt2, lineHeight: 20 },
  featB: { color: C.txt, fontWeight: '600' },

  // BLUEPRINT
  bpFeature: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 46, maxWidth: 980, alignSelf: 'center', width: '100%' },
  bp: { flexGrow: 1, flexBasis: 360, minWidth: 300, backgroundColor: C.card, borderRadius: 22, padding: 22, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  bpTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bpTag: { fontFamily: MONO, fontSize: 11, color: C.txt3 },
  bpBadge: { fontFamily: FONT, fontSize: 11, fontWeight: '600', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 980, overflow: 'hidden' },
  bpBadgeFree: { color: C.greenInk, backgroundColor: 'rgba(52,199,89,.14)' },
  bpH3: { ...baseText, fontSize: 22, fontWeight: '600', letterSpacing: -0.4, marginTop: 10, marginBottom: 6, lineHeight: 25 },
  bpAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bpAv: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bpAvText: { color: '#fff', fontSize: 9, fontWeight: '700', fontFamily: FONT },
  bpAuthorText: { ...baseText, fontSize: 12.5, color: C.txt2 },
  miniScroll: { flexDirection: 'row', gap: 14, marginTop: 8, flexWrap: 'wrap' },
  miniStep: { flexGrow: 1, flexBasis: 150, minWidth: 140 },
  miniNode: { width: 13, height: 13, borderRadius: 7, marginBottom: 13, marginLeft: 1, borderWidth: 3, borderColor: C.card },
  miniCard: { backgroundColor: C.band, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, minHeight: 92 },
  miniPill: { fontFamily: FONT, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  miniT: { ...baseText, fontSize: 13, fontWeight: '600', lineHeight: 16, marginTop: 7, marginBottom: 6 },
  miniS: { fontFamily: MONO, fontSize: 10, color: C.txt3 },
  bpAccess: { flexGrow: 1, flexBasis: 300, minWidth: 280, backgroundColor: C.card, borderRadius: 24, padding: 30, justifyContent: 'center', ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  bpAccessH4: { ...baseText, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginBottom: 7 },
  bpAccessP: { ...baseText, fontSize: 14, color: C.txt2, lineHeight: 21, marginBottom: 18 },
  joinBtn: { backgroundColor: C.blue, borderRadius: 980, paddingVertical: 13, alignItems: 'center' },
  joinBtnText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: '#fff' },
  bpDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  bpDividerLine: { flex: 1, height: 1, backgroundColor: C.lineSoft },
  bpDividerText: { fontFamily: FONT, fontSize: 12, color: C.txt3 },
  joinAlt: { backgroundColor: C.band, borderRadius: 980, paddingVertical: 13, alignItems: 'center' },
  joinAltText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: C.blue },
  bpNote: { fontFamily: FONT, fontSize: 12, color: C.txt3, marginTop: 15, textAlign: 'center', lineHeight: 18 },

  // CLAIM / orgs
  claim: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 46, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  claimSteps: { flexGrow: 1, flexBasis: 380, minWidth: 300, gap: 14 },
  cstep: { flexDirection: 'row', gap: 16, backgroundColor: C.card, borderRadius: 20, padding: 22, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  cn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(45,127,249,.12)', alignItems: 'center', justifyContent: 'center' },
  cnText: { fontFamily: FONT, color: C.blue, fontWeight: '700', fontSize: 14 },
  cstepH4: { ...baseText, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, marginBottom: 3 },
  cstepP: { ...baseText, fontSize: 13.5, color: C.txt2, lineHeight: 20 },
  claimCta: { flexGrow: 1, flexBasis: 300, minWidth: 280, backgroundColor: C.card, borderRadius: 24, padding: 28, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  claimCtaH4: { ...baseText, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  aud: { gap: 9, marginBottom: 6 },
  audTile: { ...baseText, fontSize: 13.5, fontWeight: '500', backgroundColor: C.band, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, overflow: 'hidden' },

  // INTERESTS RAIL
  rail: { marginTop: 42, width: '100%' },
  railTrack: { gap: 18, paddingTop: 8, paddingBottom: 30, paddingHorizontal: 22 },
  interest: { width: 244, backgroundColor: C.card, borderRadius: 20, padding: 22, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  interestSoon: { opacity: 0.82 },
  ic: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  icEmoji: { fontSize: 22, fontFamily: FONT },
  interestH3: { ...baseText, fontSize: 18, fontWeight: '600', letterSpacing: -0.2, marginBottom: 5 },
  orgName: { ...baseText, fontSize: 12.5, color: C.txt2, marginBottom: 18, minHeight: 34, lineHeight: 17 },
  interestFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 980 },
  statusLive: { backgroundColor: 'rgba(52,199,89,.15)' },
  statusLiveText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: C.greenInk },
  statusSoon: { backgroundColor: 'rgba(28,40,64,.06)' },
  statusSoonText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: C.txt3 },
  interestOpen: { fontFamily: FONT, fontSize: 18, color: C.txt3 },

  // FOUR MOVES
  movesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 46, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  move: { flexGrow: 1, flexBasis: 220, minWidth: 200, backgroundColor: C.card, borderRadius: 20, paddingVertical: 26, paddingHorizontal: 22, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  moveN: { fontFamily: MONO, fontSize: 12, color: C.blue, marginBottom: 18 },
  moveVerb: { ...baseText, fontSize: 13, color: C.txt3, marginBottom: 3 },
  moveH4: { ...baseText, fontSize: 21, fontWeight: '600', letterSpacing: -0.4, marginBottom: 10 },
  moveKey: { color: C.blue },
  moveP: { ...baseText, fontSize: 13.5, color: C.txt2, lineHeight: 20 },

  // AUTHOR
  authorCard: { maxWidth: 620, width: '100%', alignSelf: 'center', marginTop: 46, backgroundColor: C.card, borderRadius: 24, padding: 28, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  pav: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pavText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: FONT },
  pn: { ...baseText, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  pr: { fontFamily: MONO, fontSize: 11, color: C.txt3, marginTop: 2 },
  roleTagAuthor: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 980, backgroundColor: 'rgba(45,127,249,.12)' },
  roleTagAuthorText: { fontFamily: FONT, fontSize: 10, fontWeight: '600', color: C.blue },
  authorBody: { ...baseText, fontSize: 15, lineHeight: 23, marginTop: 4 },
  phNote: { color: C.txt3, fontStyle: 'italic' },
  personFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  pstat: { fontFamily: MONO, fontSize: 11, color: C.txt3 },
  follow: { backgroundColor: C.band, borderRadius: 980, paddingVertical: 8, paddingHorizontal: 18 },
  followText: { fontFamily: FONT, fontSize: 12.5, fontWeight: '500', color: C.blue },

  // PRICING
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 46, maxWidth: 900, alignSelf: 'center', width: '100%' },
  priceCard: { flexGrow: 1, flexBasis: 380, minWidth: 300, backgroundColor: C.card, borderRadius: 22, padding: 34, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  priceCardFeature: { borderWidth: 2, borderColor: C.blue },
  priceIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  priceH3: { ...baseText, fontSize: 25, fontWeight: '600', letterSpacing: -0.5, marginBottom: 8 },
  priceTiers: { fontFamily: MONO, fontSize: 12.5, color: C.txt3, marginBottom: 24 },
  priceTiersB: { color: C.txt },
  priceFeat: { gap: 13, marginBottom: 24 },
  priceFeatLi: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  check: { width: 19, height: 19, borderRadius: 10, backgroundColor: 'rgba(52,199,89,.15)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: C.greenInk },
  priceFeatText: { ...baseText, fontSize: 14, color: C.txt2, flex: 1, lineHeight: 19 },
  priceNote: { fontFamily: FONT, fontSize: 12, color: C.txt3, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.lineSoft, lineHeight: 17 },

  // 1% FOR ACCESS
  giveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 48, marginTop: 8, alignItems: 'center' },
  giveLeft: { flexGrow: 1, flexBasis: 360, minWidth: 300 },
  giveBadge: { width: 128, height: 128, borderRadius: 64, borderWidth: 2, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  giveBadgePct: { fontFamily: FONT, fontSize: 38, fontWeight: '800', letterSpacing: -1.1, color: C.blue },
  giveBadgeFor: { fontFamily: FONT, fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: C.blue, marginTop: 5, textTransform: 'uppercase' },
  giveLeftH2: { ...baseText, fontSize: 32, fontWeight: '700', letterSpacing: -0.9, lineHeight: 35, marginBottom: 16 },
  giveLeftP: { ...baseText, fontSize: 16, color: C.txt2, lineHeight: 26, marginBottom: 14, maxWidth: 460 },
  giveCards: { flexGrow: 1, flexBasis: 400, minWidth: 300, gap: 16 },
  giveCard: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 24, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(28,40,64,.06)' } as any) : {}) },
  gi: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  giveCardH4: { ...baseText, fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginTop: 1, marginBottom: 5 },
  giveCardP: { ...baseText, fontSize: 13.5, color: C.txt2, lineHeight: 20 },
  gtag: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: C.blue, marginTop: 11 },
  giveFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 30 },
  gnote: { fontFamily: FONT, fontSize: 12.5, color: C.txt3, maxWidth: 320, lineHeight: 18 },

  // FINAL CTA
  final: { paddingVertical: 100, width: '100%' },
  finalH2: { ...baseText, fontSize: 48, fontWeight: '700', letterSpacing: -1.5, lineHeight: 50, textAlign: 'center', maxWidth: 640, alignSelf: 'center' },
  finalH2Em: { color: C.blue },
  finalP: { ...baseText, fontSize: 19, color: C.txt2, marginTop: 18, lineHeight: 27, textAlign: 'center', maxWidth: 540, alignSelf: 'center' },
  finalCtaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, justifyContent: 'center', alignItems: 'center', marginTop: 30 },

  // FOOTER
  footer: { paddingTop: 56, paddingBottom: 40, width: '100%', borderTopWidth: 1, borderTopColor: C.line },
  footGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 30 },
  footBrand: { flexGrow: 1, flexBasis: 320, minWidth: 240 },
  footBrandP: { fontFamily: FONT, fontSize: 13, color: C.txt3, marginTop: 13, maxWidth: 320, lineHeight: 20 },
  footCol: { flexGrow: 1, flexBasis: 140, minWidth: 120 },
  footColH5: { ...baseText, fontSize: 12, fontWeight: '600', marginBottom: 14 },
  footColA: { fontFamily: FONT, fontSize: 13, color: C.txt2, marginBottom: 10 },
  footBottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 36, paddingTop: 22, borderTopWidth: 1, borderTopColor: C.line },
  footBottomText: { fontFamily: FONT, fontSize: 12.5, color: C.txt3 },
  footBottomMono: { fontFamily: MONO, fontSize: 12.5, color: C.txt3, letterSpacing: 0.5 },
});
