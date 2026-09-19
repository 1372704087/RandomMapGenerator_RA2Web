// 0x5a7250 Placeability_Gate size=1E6

char __fastcall sub_5A7250(int *a1, char a2, char a3)
{
  int v4; // eax
  int v5; // esi
  int v6; // edx
  int v7; // edi
  int v8; // edi
  int v9; // esi
  int v10; // ebx
  int v11; // edi
  int *v12; // esi
  int v15; // [esp+14h] [ebp-Ch] BYREF
  int v16; // [esp+18h] [ebp-8h]
  int v17; // [esp+1Ch] [ebp-4h]

  v4 = *a1;
  v5 = (__int16)*a1;
  v15 = a1[1];
  v16 = (__int16)v15 + v5;
  if ( v16 <= dword_ABED04 )
    return 0;
  if ( v5 - (__int16)v15 >= dword_ABED04 )
    return 0;
  if ( (__int16)v15 - v5 >= dword_ABED04 )
    return 0;
  if ( v16 > dword_ABED08 )
    return 0;
  v6 = a1[2];
  v7 = (__int16)(v4 + v6 - 1);
  v16 = (__int16)v15 + v7;
  if ( v16 <= dword_ABED04 )
    return 0;
  if ( v7 - (__int16)v15 >= dword_ABED04 )
    return 0;
  if ( (__int16)v15 - v7 >= dword_ABED04 )
    return 0;
  if ( v16 > dword_ABED08 )
    return 0;
  v17 = a1[3] + v15 - 1;
  v16 = (__int16)v17 + (__int16)v4;
  if ( v16 <= dword_ABED04 )
    return 0;
  if ( (__int16)v4 - (__int16)v17 >= dword_ABED04 )
    return 0;
  if ( (__int16)v17 - (__int16)v4 >= dword_ABED04 )
    return 0;
  if ( v16 > dword_ABED08 )
    return 0;
  v8 = (__int16)(v4 + v6 - 1);
  v9 = (__int16)v17;
  v17 = (__int16)v17 + v8;
  if ( v17 <= dword_ABED04 || v8 - v9 >= dword_ABED04 || v9 - v8 >= dword_ABED04 || v17 > dword_ABED08 )
    return 0;
  v10 = v15;
  if ( v15 < v15 + a1[3] )
  {
    do
    {
      v11 = v4;
      if ( v4 < v6 + v4 )
      {
        do
        {
          LOWORD(v15) = v11;
          HIWORD(v15) = v10;
          v12 = (int *)sub_5657A0(&stru_87F7E8, (__int16 *)&v15);
          if ( sub_4866D0(v12) )
          {
            if ( a2 == 0 )
              return 0;
          }
          else if ( sub_4866F0(v12) )
          {
            if ( a3 == 0 )
              return 0;
          }
          else if ( !sub_486380(v12) && !sub_486650(v12) && !sub_486670(v12) )
          {
            return 0;
          }
          v6 = a1[2];
          v4 = *a1;
          ++v11;
        }
        while ( v11 < v6 + *a1 );
      }
      ++v10;
    }
    while ( v10 < a1[3] + a1[1] );
  }
  return 1;
}
