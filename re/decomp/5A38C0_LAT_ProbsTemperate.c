// 0x5a38c0 LAT_ProbsTemperate size=191

int __thiscall sub_5A38C0(int *this)
{
  int result; // eax
  int v3; // ebx
  char *v4; // esi
  int v5; // eax
  int v6; // edx
  int v7; // ecx
  int v8; // edi
  int v9; // edx
  int j; // [esp+14h] [ebp-Ch]
  double i; // [esp+18h] [ebp-8h]

  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  v3 = result;
  for ( i = (double)*(this + 23) * 0.01; result != 0; v3 = result )
  {
    v4 = (char *)dword_ABED10
       + 80 * (__int16)*(_DWORD *)(v3 + 36)
       + 80 * dword_89C2DC * (__int16)HIWORD(*(_DWORD *)(v3 + 36));
    if ( (unsigned __int8)sub_4865B0(v3) != 0 )
    {
      v5 = *(_DWORD *)(v3 + 36);
      v6 = (__int16)v5 - 2;
      for ( j = v6; v6 < (__int16)v5 + 3; j = v6 )
      {
        v7 = SHIWORD(v5) - 2;
        if ( v7 < SHIWORD(v5) + 3 )
        {
          v8 = (__int16)v6;
          do
          {
            v9 = (__int16)v7 + v8;
            if ( v9 > dword_ABED04
              && v8 - (__int16)v7 < dword_ABED04
              && (__int16)v7 - v8 < dword_ABED04
              && v9 <= dword_ABED08 )
            {
              *((_DWORD *)v4 + 10) = 1202590843;
              *((_DWORD *)v4 + 11) = 1064598241;
              *((_DWORD *)v4 + 8) = 0;
              *((_DWORD *)v4 + 9) = 0;
              *((double *)v4 + 3) = 0.02 * i * 10.0;
            }
            ++v7;
          }
          while ( v7 < (__int16)HIWORD(*(_DWORD *)(v3 + 36)) + 3 );
          v6 = j;
        }
        v5 = *(_DWORD *)(v3 + 36);
        ++v6;
      }
    }
    else if ( *((double *)v4 + 5) == 0.0 )
    {
      *((_DWORD *)v4 + 10) = 1202590843;
      *((_DWORD *)v4 + 11) = 1064598241;
      *((double *)v4 + 3) = 0.02 * i;
      *((_DWORD *)v4 + 8) = 1202590843;
      *((_DWORD *)v4 + 9) = 1064598241;
    }
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
