import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Statblock } from '../../types';

// Statblock Display Component
export function StatblockDisplay({ statblock }: { statblock: Statblock }) {
  const abilityNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const formatSpeed = () => {
    const speeds: string[] = [];
    if (statblock.speed.walk) speeds.push(`${statblock.speed.walk} ft.`);
    if (statblock.speed.fly) speeds.push(`fly ${statblock.speed.fly} ft.`);
    if (statblock.speed.swim) speeds.push(`swim ${statblock.speed.swim} ft.`);
    if (statblock.speed.burrow) speeds.push(`burrow ${statblock.speed.burrow} ft.`);
    if (statblock.speed.climb) speeds.push(`climb ${statblock.speed.climb} ft.`);
    return speeds.join(', ') || '0 ft.';
  };

  const formatSavingThrows = () => {
    if (!statblock.savingThrows) return null;
    const saves: string[] = [];
    abilityNames.forEach(ability => {
      const save = statblock.savingThrows?.[ability];
      if (save !== undefined) {
        saves.push(`${ability.toUpperCase()} ${save >= 0 ? '+' : ''}${save}`);
      }
    });
    return saves.length > 0 ? saves.join(', ') : null;
  };

  const formatSkills = () => {
    if (!statblock.skills || Object.keys(statblock.skills).length === 0) return null;
    return Object.entries(statblock.skills)
      .map(([skill, bonus]) => `${skill} ${bonus >= 0 ? '+' : ''}${bonus}`)
      .join(', ');
  };

  return (
    <Box sx={{ fontFamily: 'serif' }}>
      {/* Basic Stats */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
        <Stack spacing={0.5}>
          <Typography variant="body2">
            <strong>Armor Class</strong> {statblock.ac}{statblock.acType && ` (${statblock.acType})`}
          </Typography>
          <Typography variant="body2">
            <strong>Hit Points</strong> {statblock.maxHp} ({statblock.hitDice})
          </Typography>
          <Typography variant="body2">
            <strong>Speed</strong> {formatSpeed()}
          </Typography>
        </Stack>
      </Paper>

      {/* Ability Scores */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
        <Stack direction="row" spacing={2} justifyContent="space-around">
          {abilityNames.map(ability => (
            <Box key={ability} sx={{ textAlign: 'center' }}>
              <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                {ability}
              </Typography>
              <Typography variant="body1" fontFamily="monospace">
                {statblock.abilities[ability]} ({getModifier(statblock.abilities[ability])})
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Secondary Stats */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
        <Stack spacing={0.5}>
          {formatSavingThrows() && (
            <Typography variant="body2">
              <strong>Saving Throws</strong> {formatSavingThrows()}
            </Typography>
          )}
          {formatSkills() && (
            <Typography variant="body2">
              <strong>Skills</strong> {formatSkills()}
            </Typography>
          )}
          {statblock.damageVulnerabilities && statblock.damageVulnerabilities.length > 0 && (
            <Typography variant="body2">
              <strong>Damage Vulnerabilities</strong> {statblock.damageVulnerabilities.join(', ')}
            </Typography>
          )}
          {statblock.damageResistances && statblock.damageResistances.length > 0 && (
            <Typography variant="body2">
              <strong>Damage Resistances</strong> {statblock.damageResistances.join(', ')}
            </Typography>
          )}
          {statblock.damageImmunities && statblock.damageImmunities.length > 0 && (
            <Typography variant="body2">
              <strong>Damage Immunities</strong> {statblock.damageImmunities.join(', ')}
            </Typography>
          )}
          {statblock.conditionImmunities && statblock.conditionImmunities.length > 0 && (
            <Typography variant="body2">
              <strong>Condition Immunities</strong> {statblock.conditionImmunities.join(', ')}
            </Typography>
          )}
          <Typography variant="body2">
            <strong>Senses</strong> {statblock.senses}
          </Typography>
          <Typography variant="body2">
            <strong>Languages</strong> {statblock.languages}
          </Typography>
          <Typography variant="body2">
            <strong>Challenge</strong> {statblock.cr}
          </Typography>
        </Stack>
      </Paper>

      {/* Traits */}
      {statblock.traits && statblock.traits.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Traits
          </Typography>
          <Stack spacing={1}>
            {statblock.traits.map((trait, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{trait.name}.</em></strong> {trait.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Actions */}
      {statblock.actions && statblock.actions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Actions
          </Typography>
          <Stack spacing={1}>
            {statblock.actions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Bonus Actions */}
      {statblock.bonusActions && statblock.bonusActions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Bonus Actions
          </Typography>
          <Stack spacing={1}>
            {statblock.bonusActions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Reactions */}
      {statblock.reactions && statblock.reactions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Reactions
          </Typography>
          <Stack spacing={1}>
            {statblock.reactions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Legendary Actions */}
      {statblock.legendaryActions && statblock.legendaryActions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Legendary Actions
          </Typography>
          {statblock.legendaryActionsPerRound && (
            <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
              The creature can take {statblock.legendaryActionsPerRound} legendary actions, choosing from the options below.
            </Typography>
          )}
          <Stack spacing={1}>
            {statblock.legendaryActions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
