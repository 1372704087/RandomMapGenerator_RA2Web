// 0x6b4240 Corner_C size=16D

int __fastcall sub_6B4240(int a1, int a2)
{
  int v2; // esi
  int v3; // edi
  int v4; // ecx
  int v5; // ebx
  char v6; // dl
  int v7; // ecx
  int v8; // esi
  int v9; // edi
  char v10; // dl
  char v11; // dl
  char v12; // al
  int v13; // esi
  int v14; // edi
  int *v15; // eax
  int i; // edx
  int result; // eax
  int v18; // ecx
  _BYTE *v19; // edx
  int v20; // ecx
  _BYTE *v21; // esi
  int *v22; // edx
  int v23; // ecx
  _BYTE *v24; // edi
  int *v25; // edx
  int v26; // [esp+10h] [ebp-38h]
  _DWORD v28[5]; // [esp+18h] [ebp-30h] BYREF
  _BYTE v29[4]; // [esp+2Ch] [ebp-1Ch] BYREF
  int v30; // [esp+30h] [ebp-18h]
  char v31; // [esp+34h] [ebp-14h]
  char v32; // [esp+35h] [ebp-13h]
  int v33; // [esp+38h] [ebp-10h]
  char v34; // [esp+3Ch] [ebp-Ch]
  char v35; // [esp+3Dh] [ebp-Bh]
  int v36; // [esp+40h] [ebp-8h]
  char v37; // [esp+44h] [ebp-4h]
  char v38; // [esp+45h] [ebp-3h]

  v26 = *(_DWORD *)(a1 + 36);
  v2 = (__int16)v26 - dword_8759A8;
  v3 = SHIWORD(v26) - dword_8759AC;
  v4 = v3 * dword_8759A4 + v2;
  v5 = *((_DWORD *)dword_B0B6EC + 2 * v4);
  v29[0] = *((_BYTE *)dword_B0B6EC + 8 * v4 + 4);
  v29[1] = *((_BYTE *)dword_B0B6EC + 8 * v4 + 5);
  v30 = *((_DWORD *)dword_B0B6EC + 2 * v4 + 2);
  v6 = *((_BYTE *)dword_B0B6EC + 8 * v4 + 12);
  LOBYTE(v4) = *((_BYTE *)dword_B0B6EC + 8 * v4 + 13);
  v31 = v6;
  v32 = v4;
  v7 = dword_8759A4 * (v3 + 1) + v2;
  v28[4] = v5;
  v28[0] = v5;
  v8 = *((_DWORD *)dword_B0B6EC + 2 * v7 + 2);
  v9 = *((_DWORD *)dword_B0B6EC + 2 * v7);
  v34 = *((_BYTE *)dword_B0B6EC + 8 * v7 + 12);
  v10 = *((_BYTE *)dword_B0B6EC + 8 * v7 + 13);
  v33 = v8;
  v35 = v10;
  v11 = *((_BYTE *)dword_B0B6EC + 8 * v7 + 4);
  v12 = *((_BYTE *)dword_B0B6EC + 8 * v7 + 5);
  v36 = v9;
  v37 = v11;
  v38 = v12;
  v28[2] = v8;
  v28[3] = v9;
  v28[1] = v30;
  v13 = 1000;
  v14 = -1;
  v15 = v28;
  for ( i = 4; i != 0; --i )
  {
    if ( *v15 < v13 )
      v13 = *v15;
    if ( *v15 > v14 )
      v14 = *v15;
    ++v15;
  }
  result = 0;
  if ( v14 == v13 )
  {
    v18 = 0;
    v19 = v29;
    do
    {
      if ( *v19 == 0 )
        result += 1 << v18;
      ++v18;
      v19 += 8;
    }
    while ( v18 < 4 );
  }
  else if ( a2 <= 0 )
  {
    v23 = 0;
    v24 = v29;
    v25 = v28;
    do
    {
      if ( *v25 > v13 && *v24 == 0 )
        result += 1 << v23;
      ++v23;
      ++v25;
      v24 += 8;
    }
    while ( v23 < 4 );
  }
  else
  {
    v20 = 0;
    v21 = v29;
    v22 = v28;
    do
    {
      if ( *v22 < v14 && *v21 == 0 )
        result += 1 << v20;
      ++v20;
      ++v22;
      v21 += 8;
    }
    while ( v20 < 4 );
  }
  return result;
}
