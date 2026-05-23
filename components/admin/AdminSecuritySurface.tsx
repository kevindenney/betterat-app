/**
 * Org Admin · SSO & domain (Frame 32 of the JHSON Admin Suite)
 *
 * Unifies the SSO and Domain sidebar items: SAML metadata XML upload,
 * IdP/SP entity IDs, attribute mappings on the left; verified domains
 * with DNS TXT status + auto-add toggles on the right.
 *
 * Demo data — SAML config + domain claim aren't wired yet.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AttrMap {
  idp: string;
  field: string;
}

const ATTR_MAPS: AttrMap[] = [
  { idp: 'NameID', field: 'email' },
  { idp: 'eduPersonAffiliation', field: 'role' },
  { idp: 'department', field: 'cohort_hint' },
  { idp: 'displayName', field: 'name' },
];

interface DomainRow {
  domain: string;
  txt: string;
  status: 'verified' | 'pending';
  badge: string;
}

const DOMAINS: DomainRow[] = [
  { domain: 'jh.edu', txt: 'betterat-verify=8c2f…', status: 'verified', badge: 'primary' },
  { domain: 'jhmi.edu', txt: 'betterat-verify=4a1d…', status: 'pending', badge: 'added Fri' },
  { domain: 'jhu.edu', txt: 'betterat-verify=b7e3…', status: 'verified', badge: 'alias' },
];

export function AdminSecuritySurface() {
  const [autoAdd, setAutoAdd] = useState(true);
  const [requireSso, setRequireSso] = useState(true);
  const [newDomain, setNewDomain] = useState('');

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.twoCol}>
        {/* Left column · SSO config */}
        <View style={s.col}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardEyebrow}>SAML 2.0 · IdP-initiated & SP-initiated</Text>
                <Text style={s.cardH3}>Identity provider</Text>
              </View>
              <View style={[s.statusChip, s.statusOk]}>
                <Ionicons name="checkmark" size={11} color="#1E8F47" />
                <Text style={[s.statusText, { color: '#1E8F47' }]}>
                  Last metadata exchange Apr 18
                </Text>
              </View>
            </View>
            <View style={s.cardBody}>
              <View style={s.fileDrop}>
                <View style={s.fileDropIco}>
                  <Ionicons name="document-text-outline" size={22} color="#28406B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fileDropTitle}>okta-jh-edu-metadata.xml</Text>
                  <Text style={s.fileDropSub}>
                    Uploaded by Dean S. Park · 4.2 KB · Apr 18, 11:14a — drop a new file to
                    re-key.
                  </Text>
                </View>
                <Pressable style={s.btnSm}>
                  <Ionicons name="refresh-outline" size={12} color="#28406B" />
                  <Text style={s.btnSmText}>Replace</Text>
                </Pressable>
                <Pressable style={s.btnSmGhost}>
                  <Ionicons name="download-outline" size={12} color="rgba(60, 60, 67, 0.6)" />
                  <Text style={s.btnSmGhostText}>Download</Text>
                </Pressable>
              </View>

              <View style={{ gap: 8, marginTop: 14 }}>
                <ConfigRow
                  label="IdP Entity ID"
                  value="http://www.okta.com/exk1j8h2k9aPfX0YQ357"
                />
                <ConfigRow
                  label="ACS URL · BetterAt"
                  value="https://betterat.app/auth/saml/jhson/acs"
                />
                <ConfigRow label="SP Entity ID" value="https://betterat.app/orgs/jhson" />
              </View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardEyebrow}>Attribute mappings</Text>
                <Text style={s.cardH3}>What IdP attributes become BetterAt fields</Text>
              </View>
            </View>
            <View style={s.cardBody}>
              <View style={s.attrHead}>
                <Text style={[s.attrHeadCell, { flex: 1 }]}>IdP attribute</Text>
                <View style={{ width: 32 }} />
                <Text style={[s.attrHeadCell, { flex: 1 }]}>BetterAt field</Text>
              </View>
              {ATTR_MAPS.map((m, idx) => (
                <View key={m.idp} style={[s.attrRow, idx > 0 && s.attrRowDivider]}>
                  <View style={[s.attrCellMono, { flex: 1 }]}>
                    <Text style={s.attrCellMonoText}>{m.idp}</Text>
                  </View>
                  <View style={{ width: 32, alignItems: 'center' }}>
                    <Ionicons name="arrow-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
                  </View>
                  <View style={[s.selectFake, { flex: 1 }]}>
                    <Text style={s.selectFakeText}>{m.field}</Text>
                    <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
                  </View>
                </View>
              ))}
              <Pressable style={[s.btnSmGhost, { marginTop: 10, alignSelf: 'flex-start' }]}>
                <Ionicons name="add" size={12} color="rgba(60, 60, 67, 0.6)" />
                <Text style={s.btnSmGhostText}>Add mapping</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Right column · Domain */}
        <View style={s.col}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardEyebrow}>Verified domains</Text>
                <Text style={s.cardH3}>
                  {DOMAINS.length} domains · {DOMAINS.filter((d) => d.status === 'verified').length}{' '}
                  active
                </Text>
              </View>
            </View>
            <View style={s.cardBody}>
              {DOMAINS.map((d) => (
                <View key={d.domain} style={s.domainRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.domainName}>{d.domain}</Text>
                    <Text style={s.domainTxt}>TXT: {d.txt}</Text>
                  </View>
                  <View
                    style={[
                      s.statusChip,
                      d.status === 'verified' ? s.statusOk : s.statusWarn,
                    ]}
                  >
                    <Ionicons
                      name={d.status === 'verified' ? 'checkmark' : 'time-outline'}
                      size={11}
                      color={d.status === 'verified' ? '#1E8F47' : '#C99632'}
                    />
                    <Text
                      style={[
                        s.statusText,
                        { color: d.status === 'verified' ? '#1E8F47' : '#C99632' },
                      ]}
                    >
                      {d.status === 'verified' ? 'Verified' : 'Pending DNS'}
                    </Text>
                  </View>
                  <Text style={s.domainBadge}>{d.badge}</Text>
                  <Pressable style={s.iconBtn}>
                    <Ionicons name="ellipsis-vertical" size={13} color="rgba(60, 60, 67, 0.6)" />
                  </Pressable>
                </View>
              ))}

              <View style={s.addDomainRow}>
                <Ionicons name="add" size={18} color="rgba(40, 64, 107, 0.6)" />
                <Pressable
                  style={s.addDomainInput}
                  onPress={() => setNewDomain((v) => (v ? v : ''))}
                >
                  <Text style={[s.addDomainPlaceholder, newDomain ? s.addDomainValue : null]}>
                    {newDomain || 'Add another domain · e.g. nursing.jhu.edu'}
                  </Text>
                </Pressable>
                <Pressable style={s.btnSmPrimary}>
                  <Text style={s.btnSmPrimaryText}>Add</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardEyebrow}>Auto-add</Text>
                <Text style={s.cardH3}>Users with matching domain</Text>
              </View>
            </View>
            <View style={[s.cardBody, { gap: 14 }]}>
              <ToggleRow
                title="Auto-add new users with verified jh.edu / jhu.edu"
                sub="When someone signs up with a verified-domain email, they join JHSON automatically as Student."
                value={autoAdd}
                onValueChange={setAutoAdd}
              />
              <View style={s.toggleDivider} />
              <ToggleRow
                title="Require SSO for verified-domain emails"
                sub="Members on jh.edu must sign in via Okta. Magic-link and password disabled for them."
                value={requireSso}
                onValueChange={setRequireSso}
              />
              <View style={s.toggleDivider} />
              <View style={s.dropdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>Default cohort for auto-added members</Text>
                  <Text style={s.toggleSub}>
                    Admin still has to assign individuals to specific cohorts.
                  </Text>
                </View>
                <View style={s.selectFakeNarrow}>
                  <Text style={s.selectFakeText}>Unassigned</Text>
                  <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.configRow}>
      <Text style={s.configLabel}>{label}</Text>
      <View style={s.configValue}>
        <Text style={s.configValueText}>{value}</Text>
      </View>
      <Pressable style={s.iconBtn}>
        <Ionicons name="copy-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
      </Pressable>
    </View>
  );
}

function ToggleRow({
  title,
  sub,
  value,
  onValueChange,
}: {
  title: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <Pressable
        onPress={() => onValueChange(!value)}
        style={[s.switch, value && s.switchOn]}
      >
        <View style={[s.switchKnob, value && s.switchKnobOn]} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40 },

  twoCol: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  col: { flex: 1, gap: 18 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  cardHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  cardH3: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  cardBody: { padding: 18 },

  // File drop
  fileDrop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: '#F5F4EE',
  },
  fileDropIco: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  fileDropTitle: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  fileDropSub: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Config row
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  configLabel: {
    width: 200,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  configValue: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
  },
  configValueText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontFamily: 'Menlo',
  },

  // Attribute mappings
  attrHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6 },
  attrHeadCell: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  attrRowDivider: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)' },
  attrCellMono: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
  },
  attrCellMonoText: { fontSize: 12, color: '#1C1C1E', fontFamily: 'Menlo' },

  selectFake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
  },
  selectFakeText: { flex: 1, fontSize: 13, color: '#1C1C1E' },
  selectFakeNarrow: {
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
  },

  // Status chip
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusOk: { backgroundColor: 'rgba(30, 143, 71, 0.12)' },
  statusWarn: { backgroundColor: 'rgba(201, 150, 50, 0.14)' },
  statusText: { fontSize: 11, fontWeight: '600' },

  // Buttons
  btnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  btnSmText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },
  btnSmGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  btnSmGhostText: { fontSize: 11.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  btnSmPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#28406B',
  },
  btnSmPrimaryText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  iconBtn: { padding: 5, borderRadius: 6 },

  // Domain row
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  domainName: { fontSize: 13, color: '#1C1C1E', fontWeight: '600', fontFamily: 'Menlo' },
  domainTxt: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', fontFamily: 'Menlo', marginTop: 2 },
  domainBadge: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },

  addDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F5F4EE',
    borderRadius: 10,
  },
  addDomainInput: { flex: 1 },
  addDomainPlaceholder: { fontSize: 13, color: 'rgba(60, 60, 67, 0.4)' },
  addDomainValue: { color: '#1C1C1E' },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleTitle: { fontSize: 13, color: '#1C1C1E' },
  toggleSub: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },
  toggleDivider: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.06)' },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1D1D6',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: '#28406B' },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchKnobOn: { alignSelf: 'flex-end' },
});
