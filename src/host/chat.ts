import * as vscode from 'vscode';
import { Analyzer } from '../analyze/analyzer';

export function registerChatParticipant(context: vscode.ExtensionContext, getAnalyzer: () => Analyzer): void {
  const participant = vscode.chat.createChatParticipant('cadence.coach', async (request, _ctx, response, _token) => {
    const analyzer = getAnalyzer();
    const command = request.command || 'summary';
    try {
      if (command === 'habits') {
        const habits = analyzer.getHabits().filter((h) => h.triggered).slice(0, 8);
        response.markdown(`### Cadence habits\n\n${habits.map((h) => `- **${h.name}**: ${h.message}\n  - ${h.improvement}`).join('\n') || '_No active habit findings._'}`);
        return;
      }
      if (command === 'compare') {
        const overview = analyzer.getOverview();
        response.markdown(
          `### Harness comparison\n\n${Object.entries(overview.byHarness)
            .map(([k, v]) => `- **${k}**: ${v} sessions`)
            .join('\n')}`,
        );
        return;
      }
      if (command === 'flow') {
        const rhythm = analyzer.getRhythm();
        response.markdown(
          `### Flow & rhythm\n\n- Balance score: **${rhythm.balanceScore}**\n- Late-night ratio: **${Math.round(rhythm.lateNightRatio * 100)}%**\n- Weekend ratio: **${Math.round(rhythm.weekendRatio * 100)}%**`,
        );
        return;
      }
      const overview = analyzer.getOverview();
      response.markdown(
        `### Cadence summary\n\n- Sessions: **${overview.sessions}**\n- Requests: **${overview.requests}**\n- AI LOC: **${overview.aiLoc}**\n- Practice score: **${overview.practiceScore}**\n- Cancel rate: **${Math.round(overview.cancelRate * 100)}%**\n\n_Ask \`/habits\`, \`/compare\`, or \`/flow\` for details._`,
      );
    } catch (err) {
      response.markdown(`Cadence could not answer: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png');
  context.subscriptions.push(participant);
}
