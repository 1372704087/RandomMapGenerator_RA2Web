// 0x5a33f0 Hills_WaterShoreSeed size=1FB

int sub_5A33F0()
{
  int result; // eax
  int *i; // edi
  int v2; // esi
  int v3; // ebx
  int v4; // ecx
  __int16 v5; // ax
  int v6; // ecx
  _DWORD *v7; // eax
  int v8; // edx
  int v9; // esi
  int j; // ebp
  int v11; // eax
  __int16 v12; // cx
  int v13; // eax
  int v14; // ecx
  _DWORD *v15; // eax
  int v16; // [esp+4h] [ebp-Ch] BYREF
  int v17; // [esp+8h] [ebp-8h]
  int v18; // [esp+Ch] [ebp-4h]

  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  for ( i = (int *)result; result != 0; i = (int *)result )
  {
    if ( sub_4865B0(i) )
    {
      v2 = dword_ABED04;
      v3 = 0;
      while ( 1 )
      {
        v4 = v3 & 7;
        v16 = i[9];
        v5 = LOWORD(dword_89F688[v4]) + v16;
        LOWORD(v4) = HIWORD(dword_89F688[v4]);
        LOWORD(v17) = v5;
        HIWORD(v17) = HIWORD(v16) + v4;
        v16 = v17;
        v6 = SHIWORD(v17) + v5;
        if ( v6 > v2 && v5 - SHIWORD(v17) < v2 && SHIWORD(v17) - v5 < v2 && v6 <= dword_ABED08 )
        {
          v7 = sub_5657A0(&stru_87F7E8, (__int16 *)&v16);
          if ( sub_486380(v7) )
          {
            v8 = 80 * ((__int16)v16 + dword_89C2DC * SHIWORD(v16));
            *(_DWORD *)((char *)dword_ABED10 + v8 + 8) = 0;
            *(_DWORD *)((char *)dword_ABED10 + v8 + 12) = 1071644672;
            *((_BYTE *)dword_ABED10 + 80 * (__int16)v16 + 80 * dword_89C2DC * SHIWORD(v16) + 69) = 1;
            goto LABEL_24;
          }
          v2 = dword_ABED04;
        }
        if ( ++v3 >= 8 )
          goto LABEL_24;
      }
    }
    if ( sub_4863D0((int)i) )
    {
      v9 = dword_ABED04;
      for ( j = 0; j < 8; ++j )
      {
        v11 = j & 7;
        v16 = i[9];
        v12 = HIWORD(v16) + HIWORD(dword_89F688[v11]);
        LOWORD(v18) = v16 + LOWORD(dword_89F688[v11]);
        HIWORD(v18) = v12;
        v16 = v18;
        v13 = v12;
        v14 = v12 + (__int16)v18;
        if ( v14 > v9 && (__int16)v18 - v13 < v9 && v13 - (__int16)v18 < v9 && v14 <= dword_ABED08 )
        {
          v15 = sub_5657A0(&stru_87F7E8, (__int16 *)&v16);
          if ( sub_486380(v15) )
          {
            *((_BYTE *)dword_ABED10 + 80 * (__int16)v16 + 80 * dword_89C2DC * SHIWORD(v16) + 69) = 1;
            break;
          }
          v9 = dword_ABED04;
        }
      }
    }
LABEL_24:
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
