// @ts-nocheck

/**
 * Results Export Service
 * Handles exporting race results to various formats (CSV, PDF, Sailwave)
 */

import { Platform } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import * as FileSystem from 'expo-file-system/legacy';
import ResultsService from '../ResultsService';
import { SeriesStanding } from '../scoring/ScoringEngine';

export interface ExportOptions {
  includeRaceDetails?: boolean;
  includeDiscards?: boolean;
  includeTieBreakers?: boolean;
  format: 'csv' | 'pdf' | 'sailwave';
}

export class ResultsExportService {
  /**
   * Export results and download/share file
   */
  static async exportAndDownload(
    regattaId: string,
    regattaName: string,
    options: ExportOptions
  ): Promise<void> {
    const standings = await ResultsService.getStandings(regattaId);

    switch (options.format) {
      case 'csv':
        await this.exportCSV(regattaName, standings, options);
        break;
      case 'pdf':
        await this.exportPDF(regattaName, standings, options);
        break;
      case 'sailwave':
        await this.exportSailwave(regattaId, regattaName);
        break;
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export to CSV format
   */
  private static async exportCSV(
    regattaName: string,
    standings: SeriesStanding[],
    options: ExportOptions
  ): Promise<void> {
    const csv = this.generateCSV(standings, options);
    const fileName = `${regattaName.replace(/\s+/g, '_')}_results.csv`;

    if (Platform.OS === 'web') {
      // Web download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Mobile - save to file system and show path
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv);

      showAlert(
        'Export Complete',
        `Results saved to:\n${fileUri}`
      );
    }
  }

  /**
   * Generate CSV content
   */
  private static generateCSV(
    standings: SeriesStanding[],
    options: ExportOptions
  ): string {
    let csv = '';

    // Header row
    const headers = ['Rank', 'Sail Number', 'Sailor Name', 'Club', 'Total Points', 'Net Points'];

    // Add race columns
    if (standings.length > 0 && options.includeRaceDetails) {
      const raceCount = standings[0].race_scores.length;
      for (let i = 1; i <= raceCount; i++) {
        headers.push(`R${i}`);
      }
    }

    // Add optional columns
    if (options.includeDiscards) {
      headers.push('Discards Used');
    }
    if (options.includeTieBreakers) {
      headers.push('Tie Breaker');
    }

    csv += headers.join(',') + '\n';

    // Data rows
    for (const standing of standings) {
      const row: string[] = [
        standing.rank.toString(),
        standing.entry.sail_number,
        `"${standing.entry.sailor_name}"`,
        `"${standing.entry.club || ''}"`,
        standing.total_points.toFixed(1),
        standing.net_points.toFixed(1),
      ];

      // Add race scores
      if (options.includeRaceDetails) {
        for (const score of standing.race_scores) {
          let display: string;
          if (score.score_code) {
            display = score.score_code;
          } else if (score.excluded) {
            display = `(${score.points})`;
          } else {
            display = score.points.toString();
          }
          row.push(display);
        }
      }

      // Add optional fields
      if (options.includeDiscards) {
        row.push(standing.discards_used.toString());
      }
      if (options.includeTieBreakers && standing.tie_breaker) {
        row.push(`"${standing.tie_breaker}"`);
      }

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Export to PDF format
   * Note: Requires PDF library integration
   */
  private static async exportPDF(
    regattaName: string,
    standings: SeriesStanding[],
    options: ExportOptions
  ): Promise<void> {
    // For web, we can generate HTML and use browser print
    if (Platform.OS === 'web') {
      const html = this.generatePrintableHTML(regattaName, standings, options);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
    } else {
      // For mobile, we need a PDF library like react-native-pdf-lib
      // TODO: Implement mobile PDF generation
      throw new Error('PDF export not yet implemented for mobile. Use CSV instead.');
    }
  }

  /**
   * Generate printable HTML for PDF export
   */
  private static generatePrintableHTML(
    regattaName: string,
    standings: SeriesStanding[],
    options: ExportOptions
  ): string {
    const raceCount = standings.length > 0 ? standings[0].race_scores.length : 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${regattaName} - Results</title>
        <style>
          @media print {
            @page { margin: 1cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #4a90e2;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .rank {
            font-weight: bold;
            text-align: center;
          }
          .excluded {
            color: #999;
          }
          .score-code {
            color: #e74c3c;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <h1>${regattaName} - Series Results</h1>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Sail #</th>
              <th>Sailor</th>
              <th>Club</th>
              ${options.includeRaceDetails ? Array.from({ length: raceCount }, (_, i) => `<th>R${i + 1}</th>`).join('') : ''}
              <th>Total</th>
              <th>Net</th>
              ${options.includeDiscards ? '<th>Discards</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${standings.map(s => `
              <tr>
                <td class="rank">${s.rank}</td>
                <td>${s.entry.sail_number}</td>
                <td>${s.entry.sailor_name}</td>
                <td>${s.entry.club || '-'}</td>
                ${options.includeRaceDetails ? s.race_scores.map(score => {
                  if (score.score_code) {
                    return `<td class="score-code">${score.score_code}</td>`;
                  } else if (score.excluded) {
                    return `<td class="excluded">(${score.points})</td>`;
                  } else {
                    return `<td>${score.points}</td>`;
                  }
                }).join('') : ''}
                <td>${s.total_points.toFixed(1)}</td>
                <td><strong>${s.net_points.toFixed(1)}</strong></td>
                ${options.includeDiscards ? `<td>${s.discards_used}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Generated by BetterAt • RRS Appendix A Low Point Scoring System</p>
          <p>Parentheses ( ) indicate discarded scores</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Export to Sailwave format
   */
  private static async exportSailwave(
    regattaId: string,
    regattaName: string
  ): Promise<void> {
    const blwContent = await ResultsService.exportResults(regattaId, 'sailwave') as string;
    const fileName = `${regattaName.replace(/\s+/g, '_')}_sailwave.blw`;

    if (Platform.OS === 'web') {
      const blob = new Blob([blwContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, blwContent);

      showAlert(
        'Export Complete',
        `Sailwave file saved to:\n${fileUri}`
      );
    }
  }

  /**
   * Generate results summary for notifications
   */
  static generateResultsSummary(standings: SeriesStanding[]): string {
    const top3 = standings.slice(0, 3);

    let summary = 'Final Series Results:\n\n';

    top3.forEach(s => {
      summary += `${s.rank}. ${s.entry.sail_number} - ${s.entry.sailor_name} (${s.net_points} pts)\n`;
    });

    if (standings.length > 3) {
      summary += `\n... and ${standings.length - 3} more competitors`;
    }

    return summary;
  }

  /**
   * Validate results before publishing
   */
  static async validateResults(regattaId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const races = await ResultsService.getRaces(regattaId);
      const standings = await ResultsService.getStandings(regattaId);

      // Check if any races exist
      if (races.length === 0) {
        errors.push('No races have been created for this regatta');
      }

      // Check if all races are completed
      const incompletedRaces = races.filter(r => r.status !== 'completed' && r.status !== 'abandoned');
      if (incompletedRaces.length > 0) {
        warnings.push(`${incompletedRaces.length} race(s) not yet completed`);
      }

      // Check if all races are approved
      const unapprovedRaces = races.filter(r => r.status === 'completed' && !r.results_approved);
      if (unapprovedRaces.length > 0) {
        errors.push(`${unapprovedRaces.length} race(s) not yet approved`);
      }

      // Check if standings exist
      if (standings.length === 0) {
        errors.push('No standings have been calculated');
      }

      // Check for ties without tie-breakers
      const unbrokenTies = standings.filter(s => s.tied && !s.tie_breaker);
      if (unbrokenTies.length > 0) {
        warnings.push(`${unbrokenTies.length} unresolved tie(s) detected`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: ['Failed to validate results: ' + String(error)],
        warnings: [],
      };
    }
  }
}

export default ResultsExportService;
