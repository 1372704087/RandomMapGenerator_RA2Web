// 0x6b4100 Corner_B size=132

int __thiscall sub_6B4100(int *this)
{
  int v1; // edi
  int v2; // ecx
  int v3; // eax
  int v4; // esi
  int v5; // eax
  int v6; // ebp
  int v7; // ecx
  int v8; // edx
  int v9; // esi
  int *v10; // eax
  int i; // edx
  int v12; // ebx
  int *v13; // ebx
  int v14; // eax
  int v17; // [esp+14h] [ebp-14h] BYREF
  _DWORD v18[4]; // [esp+18h] [ebp-10h] BYREF

  v1 = *(this + 9);
  v17 = v1;
  v2 = SHIWORD(v1) - dword_8759AC;
  v3 = (__int16)v1 - dword_8759A8;
  v4 = v2 * dword_8759A4 + v3;
  v5 = dword_8759A4 * (v2 + 1) + v3;
  v6 = *((_DWORD *)dword_B0B6EC + 2 * v4);
  v7 = *((_DWORD *)dword_B0B6EC + 2 * v5 + 2);
  v8 = *((_DWORD *)dword_B0B6EC + 2 * v5);
  v18[1] = *((_DWORD *)dword_B0B6EC + 2 * v4 + 2);
  v18[3] = v8;
  v18[0] = v6;
  v18[2] = v7;
  v9 = 1000;
  v10 = v18;
  for ( i = 4; i != 0; --i )
  {
    if ( *v10 < v9 )
      v9 = *v10;
    ++v10;
  }
  v17 = v1;
  v12 = SHIWORD(v1) + (__int16)v1;
  if ( v12 <= dword_ABED04
    || (__int16)v1 - SHIWORD(v1) >= dword_ABED04
    || SHIWORD(v1) - (__int16)v1 >= dword_ABED04
    || v12 > dword_ABED08 )
  {
    v13 = this;
  }
  else
  {
    v13 = this;
    if ( *(this + 17) == -1 && *(this + 57) == 0 )
    {
      v17 = v1;
      if ( *(_BYTE *)(sub_58C2A0(&v17) + 69) == 0 )
      {
        v14 = *(this + 14);
        if ( v14 >= dword_A8ED38 || v14 == 0xFFFF || *(_BYTE *)(*((_DWORD *)dword_A8ED2C + v14) + 736) != 0 )
          return v9 / 15;
      }
    }
  }
  return *((char *)v13 + 283);
}
