/**
 * Org Admin · SSO & domain (Frame 32 of the JHSON Admin Suite)
 *
 * Unifies the SSO and Domain sidebar items: SAML metadata XML upload,
 * IdP/SP entity IDs, attribute mappings on the left; verified domains
 * with DNS TXT status + auto-add toggles on the right.
 *
 * Backed by org_sso_config + org_verified_domains via useOrgSecurity.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrgSecurity, AttributeMapping } from '@/hooks/useOrgSecurity';

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatBytes(n: number | null | undefined): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function AdminSecuritySurface({ orgId }: { orgId: string }) {
  const { config, domains, loading, updateConfig, addDomain, removeDomain } = useOrgSecurity(orgId);
  const [newDomain, setNewDomain] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const autoAdd = config?.autoAddVerifiedDomain ?? true;
  const requireSso = config?.requireSsoForVerifiedDomain ?? true;
  const attrMappings: AttributeMapping[] = config?.attributeMappings ?? [];

  const lastExchange = formatRelative(config?.lastMetadataExchangeAt ?? null);
  const uploadedRel = formatRelative(config?.metadataUploadedAt ?? null);
  const uploadedBy = config?.metadataUploadedByName ?? null;
  const filename = config?.metadataFilename ?? null;
  const sizeLabel = formatBytes(config?.metadataSizeBytes);

  const verifiedCount = domains.filter((d) => d.status === 'verified').length;

  const handleAddDomain = () => {
    setAddError(null);
    if (!newDomain.trim()) return;
    addDomain.mutate(
      { domain: newDomain.trim() },
      {
        onSuccess: () => setNewDomain(''),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to add domain';
          setAddError(msg);
        },
      },
    );
  };

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
              {lastExchange ? (
                <View style={[s.statusChip, s.statusOk]}>
                  <Ionicons name="checkmark" size={11} color="#1E8F47" />
                  <Text style={[s.statusText, { color: '#1E8F47' }]}>
                    Last metadata exchange {lastExchange}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={s.cardBody}>
              <View style={s.fileDrop}>
                <View style={s.fileDropIco}>
                  <Ionicons name="document-text-outline" size={22} color="#28406B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fileDropTitle}>
                    {loading ? 'Loading…' : filename ?? 'No metadata uploaded yet'}
                  </Text>
                  <Text style={s.fileDropSub}>
                    {filename
                      ? `Uploaded by ${uploadedBy ?? 'unknown'} · ${sizeLabel}${
                          uploadedRel ? ` · ${uploadedRel}` : ''
                        } — drop a new file to re-key.`
                      : 'Drop your Okta / Azure AD metadata XML here.'}
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
                <ConfigRow label="IdP Entity ID" value={config?.idpEntityId ?? '—'} />
                <ConfigRow label="ACS URL · BetterAt" value={config?.acsUrl ?? '—'} />
                <ConfigRow label="SP Entity ID" value={config?.spEntityId ?? '—'} />
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
              {attrMappings.length === 0 && !loading ? (
                <Text style={s.attrEmpty}>No mappings configured yet.</Text>
              ) : null}
              {attrMappings.map((m, idx) => (
                <View key={`${m.idp}-${idx}`} style={[s.attrRow, idx > 0 && s.attrRowDivider]}>
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
                  <Pressable
                    onPress={() => {
                      const next = attrMappings.filter((_, i) => i !== idx);
                      updateConfig.mutate({ attributeMappings: next });
                    }}
                    style={s.iconBtn}
                  >
                    <Ionicons name="close" size={14} color="rgba(60, 60, 67, 0.6)" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={[s.btnSmGhost, { marginTop: 10, alignSelf: 'flex-start' }]}
                onPress={() => {
                  const next = [
                    ...attrMappings,
                    { idp: 'newAttribute', field: 'name' } as AttributeMapping,
                  ];
                  updateConfig.mutate({ attributeMappings: next });
                }}
              >
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
                  {loading
                    ? 'Loading…'
                    : `${domains.length} domain${domains.length === 1 ? '' : 's'} · ${verifiedCount} active`}
                </Text>
              </View>
            </View>
            <View style={s.cardBody}>
              {!loading && domains.length === 0 ? (
                <Text style={s.attrEmpty}>No domains added yet.</Text>
              ) : null}
              {domains.map((d) => (
                <View key={d.id} style={s.domainRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.domainName}>{d.domain}</Text>
                    <Text style={s.domainTxt}>TXT: {d.txtRecord}</Text>
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
                  <Text style={s.domainBadge}>{d.badgeText}</Text>
                  <Pressable
                    style={s.iconBtn}
                    onPress={() => removeDomain.mutate(d.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={14} color="rgba(60, 60, 67, 0.6)" />
                  </Pressable>
                </View>
              ))}

              <View style={s.addDomainRow}>
                <Ionicons name="add" size={18} color="rgba(40, 64, 107, 0.6)" />
                <TextInput
                  style={s.addDomainInput}
                  placeholder="Add another domain · e.g. nursing.jhu.edu"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  value={newDomain}
                  onChangeText={(t) => {
                    setNewDomain(t);
                    if (addError) setAddError(null);
                  }}
                  autoCapitalize="none"
                  onSubmitEditing={handleAddDomain}
                />
                <Pressable
                  style={[s.btnSmPrimary, !newDomain.trim() && { opacity: 0.5 }]}
                  onPress={handleAddDomain}
                  disabled={!newDomain.trim() || addDomain.isPending}
                >
                  <Text style={s.btnSmPrimaryText}>
                    {addDomain.isPending ? 'Adding…' : 'Add'}
                  </Text>
                </Pressable>
              </View>
              {addError ? <Text style={s.errorLine}>{addError}</Text> : null}
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
                title="Auto-add new users with verified domains"
                sub="When someone signs up with a verified-domain email, they join this org automatically as Student."
                value={autoAdd}
                onValueChange={(v) => updateConfig.mutate({ autoAddVerifiedDomain: v })}
              />
              <View style={s.toggleDivider} />
              <ToggleRow
                title="Require SSO for verified-domain emails"
                sub="Members with verified-domain emails must sign in via SAML. Magic-link and password disabled for them."
                value={requireSso}
                onValueChange={(v) => updateConfig.mutate({ requireSsoForVerifiedDomain: v })}
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
  attrEmpty: { fontSize: 12, color: 'rgba(60, 60, 67, 0.5)', paddingVertical: 8 },
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
  addDomainInput: { flex: 1, fontSize: 13, color: '#1C1C1E', paddingVertical: 4 },
  errorLine: {
    marginTop: 8,
    fontSize: 11.5,
    color: '#C0392B',
  },

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
