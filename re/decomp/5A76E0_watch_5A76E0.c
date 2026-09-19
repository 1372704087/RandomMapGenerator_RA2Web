// 0x5a76e0 watch_5A76E0 size=1E4

char __thiscall sub_5A76E0(int *this)
{
  int v2; // ecx
  int v3; // edi
  int v4; // edx
  int v5; // esi
  int v6; // eax
  int v7; // edx
  int v8; // esi
  __int16 v9; // dx
  _DWORD *v10; // edi
  int v12; // [esp+10h] [ebp-Ch] BYREF
  int v13; // [esp+14h] [ebp-8h]
  int v14; // [esp+18h] [ebp-4h]

  v2 = *this;
  v3 = *(this + 1);
  v12 = (__int16)v3 + (__int16)v2;
  if ( v12 > dword_ABED04
    && (__int16)v2 - (__int16)v3 < dword_ABED04
    && (__int16)v3 - (__int16)v2 < dword_ABED04
    && v12 <= dword_ABED08 )
  {
    v13 = *(this + 2) + v2 - 1;
    v12 = (__int16)v3 + (__int16)v13;
    if ( v12 > dword_ABED04
      && (__int16)v13 - (__int16)v3 < dword_ABED04
      && (__int16)v3 - (__int16)v13 < dword_ABED04
      && v12 <= dword_ABED08 )
    {
      v14 = *(this + 3) + v3 - 1;
      v12 = (__int16)v14 + (__int16)v2;
      if ( v12 > dword_ABED04
        && (__int16)v2 - (__int16)v14 < dword_ABED04
        && (__int16)v14 - (__int16)v2 < dword_ABED04
        && v12 <= dword_ABED08 )
      {
        v4 = (__int16)v14;
        v14 = (__int16)v14 + (__int16)v13;
        if ( v14 > dword_ABED04
          && (__int16)v13 - v4 < dword_ABED04
          && v4 - (__int16)v13 < dword_ABED04
          && v14 <= dword_ABED08 )
        {
          if ( __OFSUB__(v3, v3 + 3) )
          {
LABEL_24:
            v8 = *this;
            if ( *this >= *this + 3 )
              return 1;
            while ( 1 )
            {
              v9 = *(this + 1) + 3;
              LOWORD(v12) = v8;
              HIWORD(v12) = v9;
              v10 = (_DWORD *)sub_5657A0(&v12);
              if ( (unsigned __int8)sub_486670(v10) == 0 && !sub_486380(v10) && (unsigned __int8)sub_486650(v10) == 0 )
                break;
              if ( ++v8 >= *this + 3 )
                return 1;
            }
          }
          else
          {
            while ( 1 )
            {
              v5 = v2;
              if ( !__OFSUB__(v2, v2 + 3) )
                break;
LABEL_23:
              if ( ++v3 >= *(this + 1) + 3 )
                goto LABEL_24;
            }
            while ( 1 )
            {
              LOWORD(v12) = v5;
              HIWORD(v12) = v3;
              v6 = sub_5657A0(&v12);
              v7 = *(_DWORD *)(v6 + 56);
              if ( (v7 < dword_ABBEC8 || v7 > dword_ABBEC8 + 1) && (unsigned __int8)sub_486730(v6) == 0 )
                break;
              v2 = *this;
              if ( ++v5 >= *this + 3 )
                goto LABEL_23;
            }
          }
        }
      }
    }
  }
  return 0;
}
