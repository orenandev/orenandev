const { PermissionFlagsBits } = require('discord.js');

const ehImune = (membro) => {
  if (!membro) return false;
  if (membro.user?.bot) return true;
  if (membro.id === membro.guild?.ownerId) return true;
  return membro.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
};

module.exports = { ehImune };
