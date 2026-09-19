// 0x6b2520 TerrainTest_Corner size=95

char __thiscall sub_6B2520(int *this)
{
  int v2; // ebx
  int v3; // edi
  int v4; // esi
  int v6; // [esp+Ch] [ebp-4h] BYREF

  v2 = *(this + 9);
  v6 = v2;
  v3 = SHIWORD(v2) + (__int16)v2;
  if ( v3 <= dword_ABED04 )
    return 0;
  if ( (__int16)v6 - SHIWORD(v6) >= dword_ABED04 )
    return 0;
  if ( SHIWORD(v6) - (__int16)v6 >= dword_ABED04 )
    return 0;
  if ( v3 > dword_ABED08 )
    return 0;
  if ( *(this + 17) != -1 )
    return 0;
  if ( *(this + 57) != 0 )
    return 0;
  v6 = v2;
  if ( *(_BYTE *)(sub_58C2A0(&v6) + 69) != 0 )
    return 0;
  v4 = *(this + 14);
  if ( v4 >= dword_A8ED38 || v4 == 0xFFFF )
    return 1;
  else
    return *(_BYTE *)(*((_DWORD *)dword_A8ED2C + v4) + 736);
}
