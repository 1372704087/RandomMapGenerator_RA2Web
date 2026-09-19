// 0x68bd00 Waypoint_C size=58

_DWORD *__thiscall sub_68BD00(__int16 *this, _DWORD *a2, int a3)
{
  _DWORD *v3; // esi
  int *v4; // eax
  int v5; // edx
  int v6; // edi
  int v7; // ecx
  _BYTE v9[12]; // [esp+8h] [ebp-Ch] BYREF

  v3 = sub_5657A0(&stru_87F7E8, this + 2 * a3 + 793);
  v4 = (int *)(*(int (__thiscall **)(_DWORD *, _BYTE *))(*v3 + 72))(v3, v9);
  v5 = *v4;
  v6 = v4[1];
  v7 = v4[2];
  if ( (v3[80] & 0x500) != 0 )
    v7 += dword_B054BC;
  *a2 = v5;
  a2[1] = v6;
  a2[2] = v7;
  return a2;
}
