export function describeBounty(bountyNote: string, bountyPoints: number): string | undefined {
  const pointsText = bountyPoints > 0 ? `${bountyPoints} points` : '';
  const parts = [bountyNote, pointsText].filter(Boolean);
  return parts.length > 0 ? `Reward for the top scorer: ${parts.join(', ')}` : undefined;
}
