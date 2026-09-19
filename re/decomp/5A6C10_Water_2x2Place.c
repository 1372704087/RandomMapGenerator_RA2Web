// 0x5a6c10 Water_2x2Place size=166

int __fastcall sub_5A6C10(int a1, _WORD *a2, int a3, int a4)
{
  _DWORD *v4; // ebp
  int result; // eax
  int v6; // ebx
  int v7; // esi
  int i; // edi
  __int16 v9; // cx
  int v10; // eax
  int v11; // ecx
  int v12; // eax
  int v13; // ecx
  int v14; // esi
  int v15; // edx
  int v16; // [esp+8h] [ebp-14h] BYREF
  int v17; // [esp+Ch] [ebp-10h]
  int v18; // [esp+10h] [ebp-Ch]
  _WORD *v19; // [esp+14h] [ebp-8h]
  int v20; // [esp+18h] [ebp-4h]

  v19 = a2;
  v4 = *((_DWORD **)dword_A8ED2C + a1);
  result = (*(int (__thiscall **)(_DWORD *))(*v4 + 156))(v4);
  v20 = result;
  if ( result != 0 )
  {
    result = v4[186];
    v6 = 0;
    v17 = 0;
    if ( result > 0 )
    {
      v7 = dword_ABED04;
      do
      {
        for ( i = 0; i < v4[185]; ++i )
        {
          v9 = v19[1] + v6;
          LOWORD(v18) = i + *v19;
          HIWORD(v18) = v9;
          v16 = v18;
          v10 = v9;
          v11 = v9 + (__int16)v18;
          if ( v11 > v7 )
          {
            if ( (__int16)v18 - v10 >= v7 || v10 - (__int16)v18 >= v7 || v11 > dword_ABED08 )
            {
              v6 = v17;
            }
            else
            {
              v12 = sub_5657A0(&v16);
              v6 = v17;
              v13 = i + v17 * v4[185];
              v14 = *(_DWORD *)(v20 + 4 * v13 + 16);
              if ( v14 != 0 )
              {
                v15 = v4[165];
                *(_BYTE *)(v12 + 282) = v13;
                *(_DWORD *)(v12 + 56) = v15;
                if ( a4 != -1 )
                  *(_BYTE *)(v12 + 283) = a4 + *(_BYTE *)(v14 + 40) - 4;
                *(_BYTE *)(v12 + 284) = *(_BYTE *)(v14 + 42);
                if ( dword_ABED10 != nullptr )
                  *((_DWORD *)dword_ABED10 + 20 * (__int16)v16 + 20 * dword_89C2DC * SHIWORD(v16) + 14) = a3;
              }
              v7 = dword_ABED04;
            }
          }
        }
        result = v4[186];
        v17 = ++v6;
      }
      while ( v6 < result );
    }
  }
  return result;
}
