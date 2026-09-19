// 0x6b3850 Corner_E size=22D

char sub_6B3850()
{
  int v0; // eax
  int v1; // ebx
  int v2; // ecx
  int v3; // edx
  int v4; // esi
  int v5; // ecx
  int v6; // edi
  int v7; // eax
  int v8; // esi
  int v9; // ecx
  int *v10; // edx
  int v11; // edi
  int v12; // eax
  int v13; // ecx
  int *v14; // eax
  int v15; // ebp
  int v16; // edx
  _DWORD *v17; // ecx
  _DWORD *v18; // eax
  int v19; // ecx
  int i; // [esp+0h] [ebp-18h]
  int v22; // [esp+4h] [ebp-14h] BYREF
  int v23; // [esp+8h] [ebp-10h] BYREF
  int v24; // [esp+Ch] [ebp-Ch]
  int v25; // [esp+10h] [ebp-8h]
  int v26; // [esp+14h] [ebp-4h]

  sub_578350(&stru_87F7E8);
  v0 = sub_578290(&stru_87F7E8);
  for ( i = v0; v0 != 0; i = v0 )
  {
    v1 = *(_DWORD *)(v0 + 36);
    v22 = v1;
    v2 = (__int16)v1 - dword_8759A8;
    v3 = SHIWORD(v1) - dword_8759AC;
    v4 = v3 * dword_8759A4 + v2;
    v5 = dword_8759A4 * (v3 + 1) + v2;
    if ( *((_BYTE *)dword_B0B6EC + 8 * v4 + 5) != 0
      || *((_BYTE *)dword_B0B6EC + 8 * v4 + 13) != 0
      || *((_BYTE *)dword_B0B6EC + 8 * v5 + 13) != 0
      || *((_BYTE *)dword_B0B6EC + 8 * v5 + 5) != 0 )
    {
      v6 = 4;
      v23 = *((_DWORD *)dword_B0B6EC + 2 * v4);
      v24 = *((_DWORD *)dword_B0B6EC + 2 * v4 + 2);
      v7 = *((_DWORD *)dword_B0B6EC + 2 * v5);
      v25 = *((_DWORD *)dword_B0B6EC + 2 * v5 + 2);
      v26 = v7;
      v8 = 1000;
      v9 = 0;
      v10 = &v23;
      do
      {
        if ( *v10 < v8 )
          v8 = *v10;
        if ( *v10 > v9 )
          v9 = *v10;
        ++v10;
        --v6;
      }
      while ( v6 != 0 );
      if ( v9 - v8 <= 15 )
      {
        v22 = v1;
        v11 = SHIWORD(v1) + (__int16)v1;
        if ( v11 > dword_ABED04
          && (__int16)v1 - SHIWORD(v1) < dword_ABED04
          && SHIWORD(v1) - (__int16)v1 < dword_ABED04
          && v11 <= dword_ABED08
          && *(_DWORD *)(i + 68) == -1
          && *(_DWORD *)(i + 228) == 0 )
        {
          v22 = v1;
          if ( *(_BYTE *)(sub_58C2A0(&v22) + 69) == 0 )
          {
            v12 = *(_DWORD *)(i + 56);
            if ( v12 >= dword_A8ED38 || v12 == 0xFFFF || *(_BYTE *)(*((_DWORD *)dword_A8ED2C + v12) + 736) != 0 )
            {
              v13 = 4;
              v14 = &v23;
              *(_BYTE *)(i + 283) = v8 / 15;
              do
              {
                v15 = *v14++;
                --v13;
                *(v14 - 1) = v15 - v8;
              }
              while ( v13 != 0 );
              v16 = 0;
              v17 = &off_83FF18;
              while ( 1 )
              {
                v18 = (_DWORD *)*v17;
                if ( *(_DWORD *)*v17 == v23 && v18[1] == v24 && v18[2] == v25 && v18[3] == v26 )
                  break;
                ++v17;
                ++v16;
                if ( (int)v17 >= (int)&off_83FF64 )
                  goto LABEL_36;
              }
              *(_BYTE *)(i + 284) = v16;
              if ( v16 != 0 )
                v19 = dword_ABC1D8 + v16 - 1;
              else
                v19 = dword_AA10B0;
              *(_DWORD *)(i + 56) = v19;
            }
          }
        }
      }
    }
LABEL_36:
    v0 = sub_578290(&stru_87F7E8);
  }
  operator delete(dword_B0B6EC);
  dword_B0B6EC = nullptr;
  return 1;
}
